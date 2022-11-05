import * as THREE from 'three'
import {VRButton} from "three/examples/jsm/webxr/VRButton"
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader"

import blimp from "../assets/Blimp.glb"
import chair from "../assets/medieval-chair.glb"
import {XRHandModelFactory} from "three/examples/jsm/webxr/XRHandModelFactory";
import {XRControllerModelFactory} from "three/examples/jsm/webxr/XRControllerModelFactory";
import fork from "../assets/Fork.glb"
import monster from "../assets/monster.glb"
import { World, System, Component, TagComponent, Types } from 'three/addons/libs/ecsy.module.js';

class Object3D extends Component { }

Object3D.schema = {
  object: { type: Types.Ref }
};

class Button extends Component { }

Button.schema = {
  // button states: [resting, pressed, fully_pressed, recovering]
  currState: { type: Types.String, default: 'resting' },
  prevState: { type: Types.String, default: 'resting' },
  pressSound: { type: Types.Ref, default: null },
  releaseSound: { type: Types.Ref, default: null },
  restingY: { type: Types.Number, default: null },
  surfaceY: { type: Types.Number, default: null },
  recoverySpeed: { type: Types.Number, default: 0.4 },
  fullPressDistance: { type: Types.Number, default: null },
  action: { type: Types.Ref, default: () => { } }
};

class ButtonSystem extends System {

  init( attributes ) {

    this.renderer = attributes.renderer;

  }

}

ButtonSystem.queries = {
  buttons: {
    components: [ Button ]
  }
};

class Pressable extends TagComponent { }

class FingerInputSystem extends System {

  init( attributes ) {

    this.hands = attributes.hands;

  }

  execute( delta/*, time*/ ) {

    this.queries.pressable.results.forEach( entity => {

      const button = entity.getMutableComponent( Button );
      const object = entity.getComponent( Object3D ).object;
      const pressingDistances = [];
      this.hands.forEach( hand => {

        if ( hand && hand.intersectBoxObject( object ) ) {

          const pressingPosition = hand.getPointerPosition();
          pressingDistances.push( button.surfaceY - object.worldToLocal( pressingPosition ).y );

        }

      } );
      if ( pressingDistances.length == 0 ) { // not pressed this frame

        if ( object.position.y < button.restingY ) {

          object.position.y += button.recoverySpeed * delta;
          button.currState = 'recovering';

        } else {

          object.position.y = button.restingY;
          button.currState = 'resting';

        }

      } else {

        button.currState = 'pressed';
        const pressingDistance = Math.max( pressingDistances );
        if ( pressingDistance > 0 ) {

          object.position.y -= pressingDistance;

        }

        if ( object.position.y <= button.restingY - button.fullPressDistance ) {

          button.currState = 'fully_pressed';
          object.position.y = button.restingY - button.fullPressDistance;

        }

      }

    } );

  }

}

FingerInputSystem.queries = {
  pressable: {
    components: [ Pressable ]
  }
};

class HandsInstructionText extends TagComponent { }

class InstructionSystem extends System {

  init( attributes ) {

    this.controllers = attributes.controllers;

  }

  execute( /*delta, time*/ ) {

    let visible = false;
    this.controllers.forEach( controller => {

      if ( controller.visible ) {

        visible = true;

      }

    } );

    this.queries.instructionTexts.results.forEach( entity => {

      const object = entity.getComponent( Object3D ).object;
      object.visible = visible;

    } );

  }

}

InstructionSystem.queries = {
  instructionTexts: {
    components: [ HandsInstructionText ]
  }
};

class NeedCalibration extends TagComponent { }

class CalibrationSystem extends System {

  init( attributes ) {

    this.camera = attributes.camera;
    this.renderer = attributes.renderer;

  }

  execute( /*delta, time*/ ) {

    this.queries.needCalibration.results.forEach( entity => {

      if ( this.renderer.xr.getSession() ) {

        const offset = entity.getComponent( OffsetFromCamera );
        const object = entity.getComponent( Object3D ).object;
        const xrCamera = this.renderer.xr.getCamera();
        object.position.x = xrCamera.position.x + offset.x;
        object.position.y = xrCamera.position.y + offset.y;
        object.position.z = xrCamera.position.z + offset.z;
        entity.removeComponent( NeedCalibration );

      }

    } );

  }

}

CalibrationSystem.queries = {
  needCalibration: {
    components: [ NeedCalibration ]
  }
};






class App {
  spheres = [];
  tmpVector1 = new THREE.Vector3();
  tmpVector2 = new THREE.Vector3();

  grabbing = false;
  scaling = {
    active: false,
    initialDistance: 0,
    object: null,
    initialScale: 1
  };
  world = new World();
  clock = new THREE.Clock();
  camera
  scene
  renderer;

  SphereRadius = 0.05;

  constructor() {
    const container = document.createElement('div')
    document.body.appendChild(container)

    this.camera = new THREE.PerspectiveCamera(50,
        window.innerWidth / window.innerHeight, 0.1, 200)
    this.camera.position.set(0, 1.6, 3)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x505050)

    const ambient = new THREE.HemisphereLight(0x606060, 0x404040, 1)
    this.scene.add(ambient)

    const light = new THREE.DirectionalLight(0xffffff)
    light.position.set(1, 1, 1).normalize()
    this.scene.add(light)

    this.renderer = new THREE.WebGLRenderer({antialias: true})
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputEncoding = THREE.sRGBEncoding
    container.appendChild(this.renderer.domElement)


    this.initScene()
    this.setupVR()

    this.renderer.setAnimationLoop(this.render.bind(this))
    window.addEventListener('resize', this.resize.bind(this))
  }


  initScene() {

    const self = this

    const geometry = new THREE.BoxBufferGeometry(.5, .5, .5)
    const material = new THREE.MeshStandardMaterial({color: 0xFF0000})
    this.mesh = new THREE.Mesh(geometry, material)
    this.scene.add(this.mesh)

    const geometrySphere = new THREE.SphereGeometry(.7, 32, 16)
    const materialSphere = new THREE.MeshBasicMaterial({color: 0xffff00})
    const sphere = new THREE.Mesh(geometrySphere, materialSphere)
    this.scene.add(sphere)

    sphere.position.set(1.5, 0, 0)


    this.loadAsset(blimp, 5, .5, -5, scene => {
      const scale = 5
      scene.scale.set(scale, scale, scale)
      self.blimp = scene
    })
    //
    // this.loadAsset(chair, .5, .5, 1, scene => {
    //   const scale = 1
    //   scene.scale.set(scale, scale, scale)
    //   self.chair = scene
    // })

    this.loadAsset(fork, 0, .5, -5, scene => {
      const scale = 0.2
      scene.scale.set(scale, scale, scale)
      self.fork = scene
    })

  }

  loadAsset(gltfFilename, x, y, z, sceneHandler) {
    const self = this
    const loader = new GLTFLoader()
    // Provide a DRACOLoader instance to decode compressed mesh data
    const draco = new DRACOLoader()
    draco.setDecoderPath('draco/')
    loader.setDRACOLoader(draco)

    loader.load(gltfFilename, (gltf) => {
          const gltfScene = gltf.scene
          self.scene.add(gltfScene)
          gltfScene.position.set(x, y, z)
          if (sceneHandler) {
            sceneHandler(gltfScene)
          }
        },
        null,
        (error) => console.error(`An error happened: ${error}`)
    )
  }

  makeButtonMesh(x, y, z, color) {

    const geometry = new THREE.BoxGeometry(x, y, z);
    const material = new THREE.MeshPhongMaterial({color: color});
    const buttonMesh = new THREE.Mesh(geometry, material);
    buttonMesh.castShadow = true;
    buttonMesh.receiveShadow = true;
    return buttonMesh;

  }

  setupVR() {
    const hand1 = renderer.xr.getHand( 0 );
    const handModel1 = new OculusHandModel( hand1 );
    hand1.add( handModel1 );
    scene.add( hand1 );

    const hand2 = renderer.xr.getHand( 1 );
    const handModel2 = new OculusHandModel( hand2 );
    hand2.add( handModel2 );
    scene.add( hand2 );

    this.renderer.xr.enabled = true
    document.body.appendChild(VRButton.createButton(this.renderer))
    /* const grip = this.renderer.xr.getControllerGrip(0)
     grip.add(new XRControllerModelFactory().createControllerModel(grip))
     this.scene.add(grip)
     const grip2 = this.renderer.xr.getControllerGrip(1)
     grip2.add(new XRControllerModelFactory().createControllerModel(grip2))
     this.scene.add(grip2)
 */

    const consoleGeometry = new THREE.BoxGeometry(0.5, 0.12, 0.15);
    const consoleMaterial = new THREE.MeshPhongMaterial({color: 0x595959});
    const consoleMesh = new THREE.Mesh(consoleGeometry, consoleMaterial);
    consoleMesh.position.set(0, 1, -0.3);
    consoleMesh.castShadow = true;
    consoleMesh.receiveShadow = true;
    this.scene.add(consoleMesh);

    const pinkButton = this.makeButtonMesh(0.08, 0.1, 0.08, 0xe84a5f);
    pinkButton.position.set(-0.05, 0.04, 0);
    consoleMesh.add(pinkButton);

    const resetButton = this.makeButtonMesh(0.08, 0.1, 0.08, 0x355c7d);
    const resetButtonText = createText('reset', 0.03);
    resetButton.add(resetButtonText);
    resetButtonText.rotation.x = -Math.PI / 2;
    resetButtonText.position.set(0, 0.051, 0);
    resetButton.position.set(0.05, 0.04, 0);
    consoleMesh.add(resetButton);

    const exitButton = this.makeButtonMesh(0.08, 0.1, 0.08, 0xff0000);
    const exitButtonText = createText('exit', 0.03);
    exitButton.add(exitButtonText);
    exitButtonText.rotation.x = -Math.PI / 2;
    exitButtonText.position.set(0, 0.051, 0);
    exitButton.position.set(0.15, 0.04, 0);
    consoleMesh.add(exitButton);

    const tkGeometry = new THREE.TorusKnotGeometry(0.5, 0.2, 200, 32);
    const tkMaterial = new THREE.MeshPhongMaterial({color: 0xffffff});
    tkMaterial.metalness = 0.8;
    const torusKnot = new THREE.Mesh(tkGeometry, tkMaterial);
    torusKnot.position.set(0, 1, -5);
    scene.add(torusKnot);

    world
        .registerComponent(Object3D)
        .registerComponent(Button)
        .registerComponent(Pressable)
        .registerComponent(Rotating)
        .registerComponent(HandsInstructionText)
        .registerComponent(OffsetFromCamera)
        .registerComponent(NeedCalibration);

    world
        .registerSystem(RotatingSystem)
        .registerSystem(InstructionSystem, {controllers: [controllerGrip1, controllerGrip2]})
        .registerSystem(CalibrationSystem, {renderer: renderer, camera: camera})
        .registerSystem(ButtonSystem, {renderer: renderer, camera: camera})
        .registerSystem(FingerInputSystem, {hands: [handModel1, handModel2]});

    const csEntity = world.createEntity();
    csEntity.addComponent(OffsetFromCamera, {x: 0, y: -0.4, z: -0.3});
    csEntity.addComponent(NeedCalibration);
    csEntity.addComponent(Object3D, {object: consoleMesh});

    const obEntity = world.createEntity();
    obEntity.addComponent(Pressable);
    obEntity.addComponent(Object3D, {object: orangeButton});
    const obAction = function () {

      torusKnot.material.color.setHex(0xffd3b5);

    };

    obEntity.addComponent(Button, {action: obAction, surfaceY: 0.05, fullPressDistance: 0.02});

    const pbEntity = world.createEntity();
    pbEntity.addComponent(Pressable);
    pbEntity.addComponent(Object3D, {object: pinkButton});
    const pbAction = function () {

      torusKnot.material.color.setHex(0xe84a5f);

    };

    pbEntity.addComponent(Button, {action: pbAction, surfaceY: 0.05, fullPressDistance: 0.02});

    const rbEntity = world.createEntity();
    rbEntity.addComponent(Pressable);
    rbEntity.addComponent(Object3D, {object: resetButton});
    const rbAction = function () {

      torusKnot.material.color.setHex(0xffffff);

    };

    rbEntity.addComponent(Button, {action: rbAction, surfaceY: 0.05, fullPressDistance: 0.02});

    const ebEntity = this.world.createEntity();
    ebEntity.addComponent(Pressable);
    ebEntity.addComponent(Object3D, {object: exitButton});
    const ebAction = function () {

      this.exitText.visible = true;
      setTimeout(function () {

        this.exitText.visible = false;
        renderer.xr.getSession().end();

      }, 2000);

    };

    ebEntity.addComponent(Button, {action: ebAction, surfaceY: 0.05, recoverySpeed: 0.2, fullPressDistance: 0.03});

    const tkEntity = world.createEntity();
    tkEntity.addComponent(Rotating);
    tkEntity.addComponent(Object3D, {object: torusKnot});

    const itEntity = world.createEntity();
    itEntity.addComponent(HandsInstructionText);
    itEntity.addComponent(Object3D, {object: instructionText});

    window.addEventListener('resize', onWindowResize);

  }
}



    //this.hand1 = hand1
    //this.hand2 = hand2


    const self = this

 /*   hand1.addEventListener( 'pinchstart', event => {
      self.onPinchStartLeft.bind(self, event).call()
    } );
    hand1.addEventListener( 'pinchend', () => {
      self.scaling.active = false;
    } );

    hand2.addEventListener( 'pinchstart', (event) => {
      self.onPinchStartRight.bind(self, event).call()
    } );
    hand2.addEventListener( 'pinchend',  (event) => {
      self.onPinchEndRight.bind(self, event).call()
    } )
  }

  onPinchStartLeft( event ) {

    const controller = event.target;

    if ( this.grabbing ) {

      const indexTip = controller.joints[ 'index-finger-tip' ];
      const sphere = this.collideObject( indexTip );

      if ( sphere ) {

        const sphere2 = this.hand2.userData.selected;
        console.log( 'sphere1', sphere, 'sphere2', sphere2 );
        if ( sphere === sphere2 ) {

          this.scaling.active = true;
          this.scaling.object = sphere;
          this.scaling.initialScale = sphere.scale.x;
          this.scaling.initialDistance = indexTip.position.distanceTo( this.hand2.joints[ 'index-finger-tip' ].position );
          return;

        }

      }

    }

    const geometry = new THREE.BoxGeometry( this.SphereRadius, this.SphereRadius, this.SphereRadius );
    const material = new THREE.MeshStandardMaterial( {
      color: Math.random() * 0xffffff,
      roughness: 1.0,
      metalness: 0.0
    } );
    const spawn = new THREE.Mesh( geometry, material );
    spawn.geometry.computeBoundingSphere();

    const indexTip = controller.joints[ 'index-finger-tip' ];
    spawn.position.copy( indexTip.position );
    spawn.quaternion.copy( indexTip.quaternion );

    this.spheres.push( spawn );

    this.scene.add( spawn );

  }

  onPinchStartRight( event ) {

    const controller = event.target;
    const indexTip = controller.joints[ 'index-finger-tip' ];
    const object = this.collideObject( indexTip );
    if ( object ) {

      this.grabbing = true;
      indexTip.attach( object );
      controller.userData.selected = object;
      console.log( 'Selected', object );

    }

  }

  onPinchEndRight( event ) {

    const controller = event.target;

    if ( controller.userData.selected !== undefined ) {

      const object = controller.userData.selected;
      object.material.emissive.b = 0;
      this.scene.attach( object );

      controller.userData.selected = undefined;
      this.grabbing = false;

    }

    this.scaling.active = false;

  }

  collideObject( indexTip ) {

    for ( let i = 0; i < this.spheres.length; i ++ ) {

      const sphere = this.spheres[ i ];
      const distance = indexTip.getWorldPosition( this.tmpVector1 ).distanceTo( sphere.getWorldPosition( this.tmpVector2 ) );

      if ( distance < sphere.geometry.boundingSphere.radius * sphere.scale.x ) {

        return sphere;

      }

    }

    return null;

  }
*/
  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  render() {
    const delta = clock.getDelta();
    const elapsedTime = clock.elapsedTime;
    renderer.xr.updateCamera( camera );
    world.execute( delta, elapsedTime );
    renderer.render( scene, camera );

    }




export {App}