import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useLocalPlayer, useVoices, useChatManager, useLoreAI, useLoreAIScene, useAvatarAnimations, useNpcManager, useScene, usePhysics, useCleanup, usePathFinder} = metaversefile;

// const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
// const localVector2 = new THREE.Vector3();
// const localVector3 = new THREE.Vector3();
// const localQuaternion = new THREE.Quaternion();
// const localMatrix = new THREE.Matrix4();

export default e => {
  const app = useApp();
  const scene = useScene();
  const npcManager = useNpcManager();
  const localPlayer = useLocalPlayer();
  const physics = usePhysics();
  const chatManager = useChatManager();
  const loreAIScene = useLoreAIScene();
  const voices = useVoices();
  const animations = useAvatarAnimations();
  const hurtAnimation = animations.find(a => a.isHurt);
  const hurtAnimationDuration = hurtAnimation.duration;

  const npcName = app.getComponent('name') ?? 'Anon';
  const npcVoiceName = app.getComponent('voice') ?? 'Sweetie Belle';
  const npcBio = app.getComponent('bio') ?? 'A generic avatar.';
  // const npcAvatarUrl = app.getComponent('avatarUrl') ?? `/avatars/drake_hacker_v3_vian.vrm`;
  const npcAvatarUrl = app.getComponent('avatarUrl') ?? `/avatars/citrine.vrm`;
  let npcWear = app.getComponent('wear') ?? [];
  if (!Array.isArray(npcWear)) {
    npcWear = [npcWear];
  }

  const PathFinder = usePathFinder();
  const pathFinder = new PathFinder({voxelHeight: 1.5, heightTolerance: 0.6, detectStep: 0.1, maxIterdetect: 1000, maxIterStep: 1000, maxVoxelCacheLen: 10000, ignorePhysicsIds: [], debugRender: false});
  /* args:
    voxelHeight: Voxel height ( Y axis ) for collide detection, usually equal to npc's physical capsule height. X/Z axes sizes are hard-coded 1 now.
    heightTolerance: Used to check whether currentVoxel can go above to neighbor voxels.
    detectStep: How height every detecting step moving.
    maxIterdetect: How many steps can one voxel detecing iterate.
    maxIterStep: How many A* path-finding step can one getPath() iterate. One A* step can create up to 4 voxels, 0 ~ 4.
    maxVoxelCacheLen: How many detected voxels can be cached.
    ignorePhysicsIds: physicsIds that voxel detect() ignored, usually npc CharacterController's capsule.
    debugRender: Whether show voxel boxes for debugging.
  */
  // window.pathFinder = pathFinder; // test
  let waypointResult = null;
  let lastWaypointResult = null;
  let lastDest = null;
  let lastGetPathTime = 0;

  let live = true;
  let vrmApp = null;
  let npcPlayer = null;
  e.waitUntil((async () => {
    const u2 = npcAvatarUrl;
    const m = await metaversefile.import(u2);
    if (!live) return;
    vrmApp = metaversefile.createApp({
      name: u2,
    });

    vrmApp.position.copy(app.position);
    vrmApp.quaternion.copy(app.quaternion);
    vrmApp.scale.copy(app.scale);
    vrmApp.updateMatrixWorld();
    vrmApp.name = 'npc';
    vrmApp.setComponent('physics', true);
    vrmApp.setComponent('activate', true);
    await vrmApp.addModule(m);
    if (!live) return;

    const position = app.position.clone()
      .add(new THREE.Vector3(0, 1, 0));
    const {quaternion, scale} = app;
    const newNpcPlayer = await npcManager.createNpc({
      name: npcName,
      avatarApp: vrmApp,
      position,
      quaternion,
      scale,
    });
    if (!live) return;

    const _setTransform = () => {
      newNpcPlayer.position.y = newNpcPlayer.avatar.height;
      newNpcPlayer.updateMatrixWorld();
    };
    _setTransform();

    const _updateWearables = async () => {
      const wearablePromises = npcWear.map(wear => (async () => {
        const {start_url} = wear;
        const app = await metaversefile.createAppAsync({
          start_url,
        });
        if (!live) return;

        newNpcPlayer.wear(app);
      })());
      await wearablePromises;
    };
    await _updateWearables();
    if (!live) return;

    const _setVoice = () => {
      const voice = voices.voiceEndpoints.find(v => v.name === npcVoiceName);
      if (voice) {
        newNpcPlayer.setVoiceEndpoint(voice.drive_id);
      } else {
        console.warn('unknown voice name', npcVoiceName, voices.voiceEndpoints);
      }
    };
    _setVoice();
    
    scene.add(vrmApp);
    
    npcPlayer = newNpcPlayer;
    window.npcPlayer = npcPlayer;
    pathFinder.setIgnorePhysicsIds([npcPlayer.characterController.physicsId]);
  })());

  app.getPhysicsObjects = () => npcPlayer ? [npcPlayer.characterController] : [];

  app.addEventListener('hit', e => {
    // console.log('npc got hit', e);

    if (!npcPlayer.hasAction('hurt')) {
      const newAction = {
        type: 'hurt',
        animation: 'pain_back',
      };
      npcPlayer.addAction(newAction);
      
      setTimeout(() => {
        npcPlayer.removeAction('hurt');
      }, hurtAnimationDuration * 1000);
    }
  });

  let targetSpec = null;
  useActivate(() => {
    // console.log('activate npc');
    if (!targetSpec) {
      targetSpec = {
        type: 'follow',
        object: npcPlayer, // Object3D
      };
    } else {
      targetSpec = null;
    }
  });

  /* console.log('got deets', {
    npcName,
    npcVoice,
    npcBio,
    npcAvatarUrl,
  }); */

  const character = loreAIScene.addCharacter({
    name: npcName,
    bio: npcBio,
  });
  // console.log('got character', character);
  character.addEventListener('say', e => {
    console.log('got character say', e.data);
    const {message, emote, action, object, target} = e.data;
    chatManager.addPlayerMessage(npcPlayer, message);
    if (emote === 'supersaiyan' || action === 'supersaiyan' || /supersaiyan/i.test(object) || /supersaiyan/i.test(target)) {
      const newSssAction = {
        type: 'sss',
      };
      npcPlayer.addAction(newSssAction);  
    } else if (action === 'follow' || (object === 'none' && target === localPlayer.name)) { // follow player
      targetSpec = {
        type: 'follow',
        object: npcPlayer,
      };
    } else if (action === 'stop') { // stop
      targetSpec = null;
    } else if (action === 'moveto' || (object !== 'none' && target === 'none')) { // move to object
      console.log('move to object', object);
      /* target = localPlayer;
      targetType = 'follow'; */
    } else if (action === 'moveto' || (object === 'none' && target !== 'none')) { // move to player
      // console.log('move to', object);
      targetSpec = {
        type: 'moveto',
        object: npcPlayer,
      };
    } else if (['pickup', 'grab', 'take', 'get'].includes(action)) { // pick up object
      console.log('pickup', action, object, target);
    } else if (['use', 'activate'].includes(action)) { // use object
      console.log('use', action, object, target);
    }
  });

  const slowdownFactor = 0.4;
  const walkSpeed = 0.075 * slowdownFactor;
  const runSpeed = walkSpeed * 8;
  const speedDistanceRate = 0.07;
  useFrame(({timestamp, timeDiff}) => {
    if (npcPlayer && physics.getPhysicsEnabled()) {
      if (targetSpec && npcFarawayLocalPlayer()) {
        if (performance.now() - lastGetPathTime > 1000 && localPlayerFarawayLastDest()) {
          // console.log('localPlayerFarawayLastDest')
          lastGetPathTime = performance.now(); // Limit the execution of `getPath()` at most once per second, to prevent `getPath()` from being executed every frame when localPlayer exceeds the detection range of `maxIterStep`, resulting in serious performance degradation.
          waypointResult = pathFinder.getPath(npcPlayer.position, localPlayer.position);
          if (waypointResult) {
            targetSpec.object = waypointResult[0];
            lastWaypointResult = waypointResult;
            lastDest = lastWaypointResult[lastWaypointResult.length - 1];
          }
        }

        if (npcReachedTarget()) {
          // console.log('npcReachedTarget')
          if (targetSpec.object._next) {
            targetSpec.object = targetSpec.object._next;
          }
        }

        // if (pathFinder.debugRender) console.log(targetSpec.object.position.x, targetSpec.object.position.z);
        const v = localVector.copy(targetSpec.object.position)
          .sub(npcPlayer.position);
        v.y = 0;
        const distance = v.length();
        if (targetSpec.type === 'moveto' && distance < 2) {
          targetSpec = null;
        } else {
          if (!npcReachedDest()) { // Fix npc jetter after reached dest problem.
            // const speed = Math.min(Math.max(walkSpeed + ((distance - 1.5) * speedDistanceRate), 0), runSpeed);
            const speed = Math.min(Math.max(walkSpeed + ((distance) * speedDistanceRate), 0), runSpeed);
            v.normalize()
              .multiplyScalar(speed * timeDiff);
            npcPlayer.characterPhysics.applyWasd(v);
          }
        }
      }

      npcPlayer.eyeballTarget.copy(localPlayer.position);
      npcPlayer.eyeballTargetEnabled = true;

      npcPlayer.updatePhysics(timestamp, timeDiff);
      npcPlayer.updateAvatar(timestamp, timeDiff);
    }
  });

  useCleanup(() => {
    live = false;

    scene.remove(vrmApp);

    if (npcPlayer) {
      npcPlayer.destroy();
    }

    loreAIScene.removeCharacter(character);
  });

  function localPlayerFarawayLastDest() {
    if (!lastDest) return true;
    return Math.abs(localPlayer.position.x - lastDest.position.x) > 3 || Math.abs(localPlayer.position.z - lastDest.position.z) > 3;
  }
  function npcReachedDest() {
    if (!lastWaypointResult) return false;
    const destResult = lastWaypointResult[lastWaypointResult.length - 1];
    return Math.abs(npcPlayer.position.x - destResult.position.x) < 0.5 && Math.abs(npcPlayer.position.z - destResult.position.z) < 0.5
  }
  function npcFarawayLocalPlayer() {
    return localVector.subVectors(localPlayer.position, npcPlayer.position).length() > 3;
  }
  function npcReachedTarget() {
    return Math.abs(npcPlayer.position.x - targetSpec.object.position.x) < .05 && Math.abs(npcPlayer.position.z - targetSpec.object.position.z) < .05;
  }

  return app;
};
