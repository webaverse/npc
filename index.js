import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useLocalPlayer, useNpcPlayerInternal, useLoaders, useScene, usePhysics, useCleanup} = metaversefile;

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

  let live = true;
  const subApps = [];
  // let physicsIds = [];
  let npcPlayer = null;
  e.waitUntil((async () => {
    // const u2 = `${baseUrl}tsumugi-taka.vrm`;
    // const u2 = `${baseUrl}rabbit.vrm`;
    // const u2 = `/avatars/drake_hacker_v3_vian.vrm`;
    const u2 = `/avatars/scillia_drophunter_v25_gloria_vian.vrm`;
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

      npcPlayer.characterPhysics.applyWasd(new THREE.Vector3(-0.05, 0, 0));

      npcPlayer.eyeballTarget.copy(localPlayer.position);
      npcPlayer.eyeballTargetEnabled = true;

      npcPlayer.updatePhysics(timestamp, timeDiff);
      npcPlayer.updateAvatar(timestamp, timeDiff);

      // window.npcPlayer = npcPlayer;
    }
  });

  useActivate(() => {
    console.log('activate npc');
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
