import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
import { Vector3 } from 'three';
const {useApp, useFrame, useAvatarInternal, useNpcPlayerInternal, useActivate, useLoaders, useScene, usePhysics, useCleanup, useLocalPlayer} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const unFrustumCull = o => {
  o.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false;
      // o.castShadow = true;
      // o.receiveShadow = true;
    }
  });
};

export default () => {
  const app = useApp();
  const scene = useScene();
  const Avatar = useAvatarInternal();
  const NpcPlayer = useNpcPlayerInternal();
  // const physics = usePhysics();

  const player = useLocalPlayer();
  
  console.log(player);
  console.log(scene);
  async function createAvatar(app) {
    await app.setSkinning(true);
    const {skinnedVrm} = app;
    const avatar = new Avatar(skinnedVrm, {
      fingers: true,
      hair: true,
      visemes: true,
      debug: false,
    });
    // avatar[appSymbol] = app;
  
    unFrustumCull(app);
  
    return avatar;
  }
  
  /* let activateCb = null;
  let frameCb = null;
  useActivate(() => {
    activateCb && activateCb();
  });
  useFrame(() => {
    frameCb && frameCb();
  }); */

  const subApps = [];
  // let physicsIds = [];
  let npcPlayer = null;
  (async () => {
    // const u2 = `${baseUrl}tsumugi-taka.vrm`;
    const u2 = `${baseUrl}rabbit.vrm`;
    const m = await metaversefile.import(u2);
    const vrmApp = metaversefile.createApp({
      name: u2,
    });

    // vrmApp.contentId = u2;
    // vrmApp.instanceId = getNextInstanceId();
    // console.log('set app position', app.position.toArray().join(','));
    vrmApp.position.copy(app.position);
    vrmApp.quaternion.copy(app.quaternion);
    vrmApp.scale.copy(app.scale);
    vrmApp.updateMatrixWorld();
    // vrmApp.name = 'npcVrm';
    vrmApp.setComponent('physics', true);
    await vrmApp.addModule(m);
    scene.add(vrmApp);
    subApps.push(vrmApp);

    const newNpcPlayer = new NpcPlayer();
    await newNpcPlayer.setAvatarAppAsync(vrmApp);
    npcPlayer = newNpcPlayer;
  })();

  app.getPhysicsObjects = () => {
    const result = [];
    for (const subApp of subApps) {
      result.push(...subApp.getPhysicsObjects());
    }
    return result;
  };
  // window.getPhysicsObjects = app.getPhysicsObjects;

  useFrame(({timestamp, timeDiff}) => {
    if (npcPlayer) {
      // console.log('update npc player');
      const f = timestamp / 5000;
      const s = Math.sin(f);
      npcPlayer.position.set(s * 2, npcPlayer.avatar.height, 0);
      npcPlayer.updateAvatar(timestamp, timeDiff);

      const distance = npcPlayer.position.distanceTo(player);
      console.log(distance);
    }
    /* if (avatar) {
      const f = timestamp / 5000;
      const s = Math.sin(f);
      avatar.inputs.hmd.position.set(s * 2, avatar.height, 0);
      avatar.setTopEnabled(false);
      avatar.setBottomEnabled(false);
      for (let i = 0; i < 2; i++) {
        avatar.setHandEnabled(i, false);
      }
      // const timeDiffS = timeDiff / 1000;
      avatar.update(timeDiff);
    } */
  });
  
  /* app.addEventListener('transformupdate', () => {
    for (const physicsObject of physicsIds) {
      _getPhysicsTransform(physicsObject.position, physicsObject.quaternion);
      physics.setTransform(physicsObject);
    }
  }); */

  /* useCleanup(() => {
    for (const physicsId of physicsIds) {
      physics.removeGeometry(physicsId);
    }
  }); */

  return app;
};
