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



 class App {
   tmpVector1 = new THREE.Vector3()
   tmpVector2 = new THREE.Vector3()
   fork;
   grabbing = false;
   scaling = {
     active: false,
     initialDistance: 0,
     object: null,
     initialScale: 1
   };
   spheres = []
   hand1
   hand2
   SphereRadius = 0.05

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

   /* this.loadAsset(blimp, -.5, .5, 1, scene => {
      const scale = 5
      scene.scale.set(scale, scale, scale)
      self.blimp = scene
    })

    this.loadAsset(chair, .5, .5, 1, scene => {
      const scale = 1
      scene.scale.set(scale, scale, scale)
      self.chair = scene
    })*/


    this.loadAsset(fork, 0, 0.8, -2, scene => {
      const scale = 0.2
      scene.scale.set(scale, scale, scale)
      self.fork = scene
    })

    this.loadAsset(monster, 0.8, 0.8, -1, scene => {
      const scale = 0.5
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

  /*changeAngle(handedness) {
    if (this.fork) {
      this.fork.rotateY(45)

    }
  }

  changePosition(handedness) {
    if (this.monster) {
      const pos = this.monster.position
      this.monster.position.set(pos.x - .5, pos.y, pos.z)

    }
  }*/





  setupVR() {
    this.renderer.xr.enabled = true
    document.body.appendChild(VRButton.createButton(this.renderer))
   /* const grip = this.renderer.xr.getControllerGrip(0)
    grip.add(new XRControllerModelFactory().createControllerModel(grip))
    this.scene.add(grip)
    const grip2 = this.renderer.xr.getControllerGrip(1)
    grip2.add(new XRControllerModelFactory().createControllerModel(grip2))
    this.scene.add(grip2)
*/

    const hand1 = this.renderer.xr.getHand(0)
    hand1.add (new XRHandModelFactory().createHandModel(hand1, "mesh"))
    this.scene.add(hand1)
    // hand1.addEventListener('selectstart',  evt => {
    //   self.changeAngle.bind(self, evt.handedness ).call();
    // } )

    const hand2 = this.renderer.xr.getHand(1)
    hand2.add (new XRHandModelFactory().createHandModel(hand2, "mesh"))
    this.scene.add(hand2)

    this.hand1 = hand1
    this.hand2 = hand2


    const self = this

    hand1.addEventListener( 'pinchstart', event => {
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

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  render() {

    if ( this.scaling.active ) {

      const indexTip1Pos = this.hand1.joints[ 'index-finger-tip' ].position;
      const indexTip2Pos = this.hand2.joints[ 'index-finger-tip' ].position;
      const distance = indexTip1Pos.distanceTo( indexTip2Pos );
      const newScale = this.scaling.initialScale + distance / this.scaling.initialDistance - 1;
      this.scaling.object.scale.setScalar( newScale );

    }

    /*if (this.fork) {
      this.fork.rotateY(0.1 * xAxis)
      this.fork.translateY(.02 * yAxis)
    }*/

    this.renderer.render(this.scene, this.camera)
  }
}

export {App}
