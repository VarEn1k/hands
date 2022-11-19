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
import { World, System, Component, TagComponent, Types } from "three/examples/jsm/libs/ecsy.module";

import scene from "three/examples/jsm/offscreen/scene";
import {
    Button, ButtonSystem,
    CalibrationSystem, FingerInputSystem,
    HandsInstructionText,
    InstructionSystem,
    NeedCalibration, Object3D, OffsetFromCamera,
    Pressable, Rotating, RotatingSystem
} from "./HandButton";
import {OculusHandModel} from "three/examples/jsm/webxr/OculusHandModel";
import {createText} from "three/examples/jsm/webxr/Text2D";



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
  camera;
  scene;
  renderer;

  SphereRadius = 0.05;
  OffsetFromCamera;
  RotatingSystem;
    Rotating;

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

    this.loadAsset(fork, 0, -1.5, -5, scene => {
      const scale = 0.2
      scene.scale.set(scale, scale, scale)
      self.fork = scene
    })

      this.loadAsset(monster, 0, .5, -5, scene => {
      const scale = 0.2
      scene.scale.set(scale, scale, scale)
      self.monster = scene
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
    const hand1 = this.renderer.xr.getHand( 0 );
    const handModel1 = new OculusHandModel( hand1 );
    hand1.add( handModel1 );
    this.scene.add( hand1 );

    const hand2 = this.renderer.xr.getHand( 1 );
    const handModel2 = new OculusHandModel( hand2 );
    hand2.add( handModel2 );
    this.scene.add( hand2 );

    this.renderer.xr.enabled = true
    document.body.appendChild(VRButton.createButton(this.renderer))


     const grip = this.renderer.xr.getControllerGrip(0)
     grip.add(new XRControllerModelFactory().createControllerModel(grip))
     this.scene.add(grip)


     const grip2 = this.renderer.xr.getControllerGrip(1)
     grip2.add(new XRControllerModelFactory().createControllerModel(grip2))
     this.scene.add(grip2)

    const consoleGeometry = new THREE.BoxGeometry(0.7, 0.12, 0.15);
    const consoleMaterial = new THREE.MeshPhongMaterial({color: 0x595959});
    const consoleMesh = new THREE.Mesh(consoleGeometry, consoleMaterial);
    consoleMesh.position.set(0, 1, -0.3);
    consoleMesh.castShadow = true;
    consoleMesh.receiveShadow = true;
    this.scene.add(consoleMesh);

    const pinkButton = this.makeButtonMesh(0.08, 0.1, 0.08, 0xe84a5f);
    pinkButton.position.set(-0.05, 0.04, 0);
    consoleMesh.add(pinkButton);

    const orangeButton = this.makeButtonMesh( 0.08, 0.1, 0.08, 0xffd3b5 );
    orangeButton.position.set( - 0.15, 0.04, 0 );
    consoleMesh.add( orangeButton );

    const resetButton = this.makeButtonMesh(0.08, 0.1, 0.08, 0x355c7d);
    const resetButtonText = createText('reset', 0.03);
    resetButton.add(resetButtonText);
    resetButtonText.rotation.x = -Math.PI / 2;
    resetButtonText.position.set(0, 0.051, 0);
    resetButton.position.set(0.05, 0.04, 0);
    consoleMesh.add(resetButton);

    const deleteButton = this.makeButtonMesh(0.08, 0.1, 0.08, 0xff0000);
    const deleteButtonText = createText('delete', 0.03);
    deleteButton.add(deleteButtonText);
    deleteButtonText.rotation.x = -Math.PI / 2;
    deleteButtonText.position.set(0, 0.051, 0);
    deleteButton.position.set(0.15, 0.04, 0);
    consoleMesh.add(deleteButton);

    const exitButton = this.makeButtonMesh(0.08, 0.1, 0.08, 0xB60DCA);
    const exitButtonText = createText('Exit', 0.03);
    exitButton.add(exitButtonText);
    exitButtonText.rotation.x = -Math.PI / 2;
    exitButtonText.position.set(0, 0.051, 0);
    exitButton.position.set(-0.25, 0.04, 0);
    consoleMesh.add(exitButton);

    const returnButton = this.makeButtonMesh(0.08, 0.1, 0.08, 0x33D424);
    const returnButtonText = createText('return', 0.03);
    returnButton.add(returnButtonText);
    returnButtonText.rotation.x = -Math.PI / 2;
    returnButtonText.position.set(0, 0.051, 0);
    returnButton.position.set(0.25, 0.04, 0);
    consoleMesh.add(returnButton);

    const tkGeometry = new THREE.TorusKnotGeometry(0.5, 0.2, 200, 32);
    const tkMaterial = new THREE.MeshPhongMaterial({color: 0xffffff});
    tkMaterial.metalness = 0.8;
    const torusKnot = new THREE.Mesh(tkGeometry, tkMaterial);
    torusKnot.position.set(0, 1, -5);
    this.scene.add(torusKnot);

    const instructionText = createText( 'This is a WebXR Hands demo, please explore with hands.', 0.04 );
    instructionText.position.set( 0, 1.6, - 0.6 );
    this.scene.add( instructionText );

    const deleteText = createText( 'Deleting object...', 0.04 );
    deleteText.position.set( 0, 1.5, - 0.6 );
    deleteText.visible = false;
    this.scene.add( deleteText );

    const returnText = createText( 'Returning object...', 0.04 );
    returnText.position.set( 0, 1.5, - 0.6 );
    returnText.visible = false;
    this.scene.add( returnText );

    const exitText = createText( 'Exit session...', 0.04 );
    exitText.position.set( 0, 1.5, - 0.6 );
    exitText.visible = false;
    this.scene.add( exitText );

    this.world
        .registerComponent(Object3D)
        .registerComponent(Button)
        .registerComponent(Pressable)
        .registerComponent(Rotating)
        .registerComponent(HandsInstructionText)
        .registerComponent(OffsetFromCamera)
        .registerComponent(NeedCalibration);

   this.world
        .registerSystem(RotatingSystem)
        .registerSystem(InstructionSystem, {controllers: [grip, grip2]})
        .registerSystem(CalibrationSystem, {renderer: this.renderer, camera: this.camera})
        .registerSystem(ButtonSystem, {renderer: this.renderer, camera: this.camera})
        .registerSystem(FingerInputSystem, {hands: [handModel1, handModel2]});

    const csEntity = this.world.createEntity();
    csEntity.addComponent(OffsetFromCamera, {x: 0, y: -0.4, z: -0.3});
    csEntity.addComponent(NeedCalibration);
    csEntity.addComponent(Object3D, {object: consoleMesh});

    const obEntity = this.world.createEntity();
    obEntity.addComponent(Pressable);
    obEntity.addComponent(Object3D, {object: orangeButton});
    const obAction = function () {

      torusKnot.material.color.setHex(0xffd3b5);

    };

    obEntity.addComponent(Button, {action: obAction, surfaceY: 0.05, fullPressDistance: 0.02});

    const pbEntity = this.world.createEntity();
    pbEntity.addComponent(Pressable);
    pbEntity.addComponent(Object3D, {object: pinkButton});
    const pbAction = function () {

      torusKnot.material.color.setHex(0xe84a5f);

    };

    pbEntity.addComponent(Button, {action: pbAction, surfaceY: 0.05, fullPressDistance: 0.02});

    const rbEntity = this.world.createEntity();
    rbEntity.addComponent(Pressable);
    rbEntity.addComponent(Object3D, {object: resetButton});
    const rbAction = function () {

      torusKnot.material.color.setHex(0xffffff);

      torusKnot.visible = true
    };

    rbEntity.addComponent(Button, {action: rbAction, surfaceY: 0.05, fullPressDistance: 0.02});

    const self = this

    const ebEntity = this.world.createEntity();
    ebEntity.addComponent(Pressable);
    ebEntity.addComponent(Object3D, {object: deleteButton});
    const ebAction = function () {


        deleteText.visible = true;
        setTimeout(function () {
            deleteText.visible = false
            torusKnot.visible = false
            renderer.xr.getSession().end();
        }, 2000)

    };

    ebEntity.addComponent(Button, {action: ebAction, surfaceY: 0.05, recoverySpeed: 0.2, fullPressDistance: 0.03});

      const reEntity = this.world.createEntity();
      reEntity.addComponent(Pressable);
      reEntity.addComponent(Object3D, {object: returnButton});
      const reAction = function () {

          returnText.visible = true;
          setTimeout(function () {
              returnText.visible = false
              torusKnot.visible = true
              renderer.xr.getSession().end();
          }, 2000)

      };


    reEntity.addComponent(Button, {action: reAction, surfaceY: 0.05, recoverySpeed: 0.2, fullPressDistance: 0.03});

      const exEntity = this.world.createEntity();
      exEntity.addComponent( Pressable );
      exEntity.addComponent( Object3D, { object: exitButton } );
      const exAction = function () {
          exitText.visible = true;
          setTimeout( function () {

              exitText.visible = false;
              self.renderer.xr.getSession().end();

          }, 2000 );

      };

      exEntity.addComponent(Button, {action: exAction, surfaceY: 0.05, recoverySpeed: 0.2, fullPressDistance: 0.03});

    const tkEntity = this.world.createEntity();
    tkEntity.addComponent(Rotating);
    tkEntity.addComponent(Object3D, {object: torusKnot});

    const itEntity = this.world.createEntity();
    itEntity.addComponent(HandsInstructionText);
    itEntity.addComponent(Object3D, {object: instructionText});

    window.addEventListener('resize', this.onWindowResize);

  }
    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );

    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    render() {
        const delta = this.clock.getDelta();
        const elapsedTime = this.clock.elapsedTime;
        this.renderer.xr.updateCamera(this.camera);
        this.world.execute(delta, elapsedTime);
        this.renderer.render(this.scene, this.camera);

    }
}

export {App}