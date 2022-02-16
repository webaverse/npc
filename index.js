import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useLocalPlayer, useNpcPlayerInternal, useLoaders, useScene, usePhysics, useCleanup, usePathFinder} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
// const localMatrix = new THREE.Matrix4();

/* const unFrustumCull = o => {
  o.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false;
      // o.castShadow = true;
      // o.receiveShadow = true;
    }
  });
}; */

export default e => {
  const app = useApp();
  const scene = useScene();
  const NpcPlayer = useNpcPlayerInternal();
  const localPlayer = useLocalPlayer();
  const physics = usePhysics();

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

  let live = true;
  const subApps = [];
  // let physicsIds = [];
  let npcPlayer = null;
  e.waitUntil((async () => {
    // const u2 = `${baseUrl}tsumugi-taka.vrm`;
    // const u2 = `${baseUrl}rabbit.vrm`;
    // const u2 = `/avatars/drake_hacker_v3_vian.vrm`;
    const u2 = `/avatars/drake_hacker_v3_vian.vrm`;
    const m = await metaversefile.import(u2);
    if (!live) return;
    const vrmApp = metaversefile.createApp({
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
    scene.add(vrmApp);
    subApps.push(vrmApp);

    const newNpcPlayer = new NpcPlayer();
    newNpcPlayer.name = 'npc';
    newNpcPlayer.position.copy(app.position)
      .add(new THREE.Vector3(0, 1, 0));
    newNpcPlayer.quaternion.copy(app.quaternion);
    await newNpcPlayer.setAvatarAppAsync(vrmApp);
    if (!live) return;
    newNpcPlayer.position.y = newNpcPlayer.avatar.height;
    newNpcPlayer.updateMatrixWorld();
    npcPlayer = newNpcPlayer;
    pathFinder.setIgnorePhysicsIds([npcPlayer.physicsObject.physicsId]);
  })());

  app.getPhysicsObjects = () => {
    const result = [];
    /* for (const subApp of subApps) {
      result.push(...subApp.getPhysicsObjects());
    } */
    if (npcPlayer) {
      // console.log('npc character controller', npcPlayer.physicsObject);
      result.push(npcPlayer.physicsObject);
    }
    return result;
  };

  let target = null; // Object3D
  useActivate(() => {
    // console.log('activate npc');
    if (!target) {
      target = npcPlayer;
    } else {
      target = null;
    }
  });

  const slowdownFactor = 0.4;
  const walkSpeed = 0.075 * slowdownFactor;
  const runSpeed = walkSpeed * 8;
  const speedDistanceRate = 0.07;
  useFrame(({timestamp, timeDiff}) => {
    if (npcPlayer && physics.getPhysicsEnabled()) {
      /* const f = timestamp / 5000;
      const s = Math.sin(f);
      // console.log('set pos', localVector.set(s * 2, npcPlayer.avatar.height, 0).toArray().join(','));
      npcPlayer.matrix.compose(
        localVector.set(s * 2, npcPlayer.avatar.height, 0),
        localQuaternion.setFromAxisAngle(localVector2.set(0, 1, 0), 0),
        localVector3.set(1, 1, 1),
      ).premultiply(app.matrixWorld).decompose(npcPlayer.position, npcPlayer.quaternion, localVector3);
      npcPlayer.updateMatrixWorld(); */

      // window.npcPlayer = npcPlayer; // test

      if (target && npcFarawayLocalPlayer()) {
        if (localPlayerFarawayLastDest()) {
          // console.log('localPlayerFarawayLastDest')

          // Don't allowNearest here, otherwise will get inaccurate result when accurate result already exists.
          waypointResult = pathFinder.getPath(npcPlayer.position, localPlayer.position, false);
          setWaypointResult(waypointResult);
        }

        const isNpcReachedDest = npcReachedDest();
        if (isNpcReachedDest) {
          // console.log('npcReachedDest')
          waypointResult = pathFinder.getPath(npcPlayer.position, localPlayer.position, true); // allowNearest
          setWaypointResult(waypointResult);

        }

        if (npcReachedTarget()) {
          // console.log('npcReachedTarget')
          if (target._next) {
            target = target._next;
          }
        }

        // if (pathFinder.debugRender) console.log(target.position.x, target.position.z);
        localVector.copy(target.position) // localVector is velocity here.
          .sub(npcPlayer.position);
        localVector.y = 0;
        const distance = localVector.length();
        // const speed = Math.min(Math.max(walkSpeed + ((distance - 1.5) * speedDistanceRate), 0), runSpeed);
        const speed = Math.min(Math.max(walkSpeed + ((distance) * speedDistanceRate), 0), runSpeed);
        if (!isNpcReachedDest) { // Fix npc jetter after reached dest problem.
          localVector.normalize()
            .multiplyScalar(speed * timeDiff);
          npcPlayer.characterPhysics.applyWasd(localVector);
        }
      } else {
        // const localVector = new THREE.Vector3(-1, 0, 0)
        //   .multiplyScalar(walkSpeed * timeDiff);
        // npcPlayer.characterPhysics.applyWasd(localVector);
      }

      npcPlayer.eyeballTarget.copy(localPlayer.position);
      npcPlayer.eyeballTargetEnabled = true;

      npcPlayer.updatePhysics(timestamp, timeDiff);
      npcPlayer.updateAvatar(timestamp, timeDiff);
    }
  });

  useCleanup(() => {
    live = false;

    for (const subApp of subApps) {
      scene.remove(subApp);
    }

    if (npcPlayer) {
      npcPlayer.destroy();
    }
  });

  function setWaypointResult(waypointResult) {
    if (waypointResult) {
      target = waypointResult[0];
      lastWaypointResult = waypointResult;
      lastDest = lastWaypointResult[lastWaypointResult.length - 1];
    }
  }

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
    return Math.abs(npcPlayer.position.x - target.position.x) < .05 && Math.abs(npcPlayer.position.z - target.position.z) < .05;
  }

  return app;
};
