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
  const pathFinder = usePathFinder();

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

  let target = null;
  useActivate(() => {
    // console.log('activate npc');
    if (!target) {
      target = pathFinder.startVoxel;
    } else {
      target = null;
    }
  });

  function calcPath() { // run after: rise(), generateVoxelMap(), and "E" activated the NPC.
    const npcX = Math.round(npcPlayer.position.x);
    const npcZ = Math.round(npcPlayer.position.z);
    const localPlayerX = Math.round(localPlayer.position.x);
    const localPlayerZ = Math.round(localPlayer.position.z);

    let startLayer, destLayer;
    const startVoxel = pathFinder.getVoxel(npcX, npcZ);
    const startVoxel2 = pathFinder.getVoxel2(npcX, npcZ);
    const destVoxel = pathFinder.getVoxel(localPlayerX, localPlayerZ);
    const destVoxel2 = pathFinder.getVoxel2(localPlayerX, localPlayerZ);
    if (Math.abs(startVoxel.position.y - npcPlayer.position.y) < Math.abs(startVoxel2.position.y - npcPlayer.position.y)) {
      startLayer = 1;
    } else {
      startLayer = 2;
    }
    if (Math.abs(destVoxel.position.y - localPlayer.position.y) < Math.abs(destVoxel2.position.y - localPlayer.position.y)) {
      destLayer = 1;
    } else {
      destLayer = 2;
    }

    pathFinder.resetStartDest(
      startLayer,
      npcX,
      npcZ,
      destLayer,
      localPlayerX,
      localPlayerZ,
    );
    pathFinder.untilFound();
    console.log(444)
    target = pathFinder.startVoxel;
  }

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

      // window.npcPlayer = npcPlayer;

      if (target) {
        if (Math.abs(localPlayer.position.x - pathFinder.destVoxel.position.x) > 3 || Math.abs(localPlayer.position.z - pathFinder.destVoxel.position.z) > 3) {
          calcPath();
        }

        if (Math.abs(npcPlayer.position.x - target.position.x) < 0.5 && Math.abs(npcPlayer.position.z - target.position.z) < 0.5) {
          if (target._next) {
            console.log(555);
            target = target._next;
          }
        }

        console.log(target.position.x, target.position.z);
        const v = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld)
          .sub(npcPlayer.position);
        v.y = 0;
        const distance = v.length();
        // const speed = Math.min(Math.max(walkSpeed + ((distance - 1.5) * speedDistanceRate), 0), runSpeed);
        const speed = Math.min(Math.max(walkSpeed + ((distance) * speedDistanceRate), 0), runSpeed);
        v.normalize()
          .multiplyScalar(speed * timeDiff);
        npcPlayer.characterPhysics.applyWasd(v);
      } else {
        // const v = new THREE.Vector3(-1, 0, 0)
        //   .multiplyScalar(walkSpeed * timeDiff);
        // npcPlayer.characterPhysics.applyWasd(v);
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

  return app;
};
