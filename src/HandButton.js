import {Component, System, TagComponent, Types} from "three/examples/jsm/libs/ecsy.module";
import * as THREE from "three";

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
        this.soundAdded = false;

    }

    execute( /*delta, time*/ ) {

        let buttonPressSound, buttonReleaseSound;
        if ( this.renderer.xr.getSession() && ! this.soundAdded ) {

            const xrCamera = this.renderer.xr.getCamera();

            const listener = new THREE.AudioListener();
            xrCamera.add( listener );

            // create a global audio source
            buttonPressSound = new THREE.Audio( listener );
            buttonReleaseSound = new THREE.Audio( listener );

            // load a sound and set it as the Audio object's buffer
            const audioLoader = new THREE.AudioLoader();
            audioLoader.load( 'sounds/button-press.ogg', function ( buffer ) {

                buttonPressSound.setBuffer( buffer );

            } );
            audioLoader.load( 'sounds/button-release.ogg', function ( buffer ) {

                buttonReleaseSound.setBuffer( buffer );

            } );
            this.soundAdded = true;

        }

        this.queries.buttons.results.forEach( entity => {

            const button = entity.getMutableComponent( Button );
            const buttonMesh = entity.getComponent( Object3D ).object;
            // populate restingY
            if ( button.restingY == null ) {

                button.restingY = buttonMesh.position.y;

            }

            if ( buttonPressSound ) {

                button.pressSound = buttonPressSound;

            }

            if ( buttonReleaseSound ) {

                button.releaseSound = buttonReleaseSound;

            }

            if ( button.currState == 'fully_pressed' && button.prevState != 'fully_pressed' ) {

                button.pressSound?.play();
                button.action();

            }

            if ( button.currState == 'recovering' && button.prevState != 'recovering' ) {

                button.releaseSound?.play();

            }

            // preserve prevState, clear currState
            // FingerInputSystem will update currState
            button.prevState = button.currState;
            button.currState = 'resting';

        } );

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
            if ( pressingDistances.length === 0 ) { // not pressed this frame

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

class Rotating extends TagComponent { }

class RotatingSystem extends System {

    execute( delta/*, time*/ ) {

        this.queries.rotatingObjects.results.forEach( entity => {

            const object = entity.getComponent( Object3D ).object;
            object.rotation.x += 0.4 * delta;
            object.rotation.y += 0.4 * delta;

        } );

    }

}

RotatingSystem.queries = {
    rotatingObjects: {
        components: [ Rotating ]
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

class OffsetFromCamera extends Component { }

OffsetFromCamera.schema = {
    x: { type: Types.Number, default: 0 },
    y: { type: Types.Number, default: 0 },
    z: { type: Types.Number, default: 0 },
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

export {Pressable, FingerInputSystem, NeedCalibration, CalibrationSystem,
    InstructionSystem, ButtonSystem, HandsInstructionText, Button,
    Component, TagComponent, Types, System, OffsetFromCamera,
    RotatingSystem, Rotating,Object3D }