import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useLocalPlayer, useChatManager, useLoreAI, useNpcManager, useScene, usePhysics, useCleanup} = metaversefile;

// const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
// const localMatrix = new THREE.Matrix4();

const characterLore = `\
# Setting

AI anime avatars in a virtual world. They have human-level intelligence.
`;
const _makeChatPrompt = (srcCharacterName, dstCharacterName, srcBio, dstBio, messages) => `\
${characterLore}

# Characters

${srcCharacterName}: ${srcBio}

${dstCharacterName}:  ${dstBio}

# Scene 1

${
  messages.map(m => {
    return `${m.name}: ${m.message}`;
  }).join('\n')
}
${((messages.length % 2) === 1) ?
  `${dstCharacterName}:`
:
  `${srcCharacterName}:`
}`;

export default e => {
  const app = useApp();
  const scene = useScene();
  const npcManager = useNpcManager();
  const localPlayer = useLocalPlayer();
  const physics = usePhysics();
  const chatManager = useChatManager();
  const loreAI = useLoreAI();

  const localPlayerName = `Scillia`;
  const npcName = `Drake`;
  const npcNameLowerCase = npcName.toLowerCase();
  const localPlayerBio = `\
Nickname Scilly or SLY. 13/F drop hunter. She is an adventurer, swordfighter and fan of potions. She is exceptionally skilled.
`;
  const npcBio = `\
Nickname DRK. 15/M hacker. He is slightly evil, and is not above cheating. He has his own strong morals.
`;
  const npcVoice = `1PUUS71w2ik0uuycNB30nXFze8C7O8OzY`;

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
    subApps.push(vrmApp);

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
    newNpcPlayer.position.y = newNpcPlayer.avatar.height;
    newNpcPlayer.updateMatrixWorld();
    newNpcPlayer.setVoice(npcVoice);

    scene.add(vrmApp);
    
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
      target = localPlayer;
    } else {
      target = null;
    }
  });

  const messages = [];
  let waiting = false;
  chatManager.addEventListener('messageadd', async e => {
    const {player, message} = e.data;
    // console.log('message add', player !== npcPlayer, !waiting)
    
    if (player !== npcPlayer && !waiting) { // message from someone else, and we are ready for it
      const messageText = message.message;
      if (messages.length > 0 || messageText.toLowerCase().includes(npcNameLowerCase)) { // continuation or start of conversation
        messages.push({
          name: localPlayerName,
          message: messageText,
        });
        const prompt = _makeChatPrompt(localPlayerName, npcName, localPlayerBio, npcBio, messages);
        console.log('got prompt', [prompt]);

        {
          waiting = true;
          let response = await loreAI.generate(prompt, {
            end: '\n',
            maxTokens: 100,
          });
          waiting = false;

          response = response.trimLeft();
          chatManager.addPlayerMessage(npcPlayer, response);
          messages.push({
            name: npcName,
            message: response,
          });
        
          console.log('got response', [response], {waiting});
        }
        // console.log('got third party message', message);
      }
    }
    // console.log('message add', e);
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

      // window.npcPlayer = npcPlayer;

      if (target) {
        const v = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld)
          .sub(npcPlayer.position);
        v.y = 0;
        const distance = v.length();
        const speed = Math.min(Math.max(walkSpeed + ((distance - 1.5) * speedDistanceRate), 0), runSpeed);
        v.normalize()
          .multiplyScalar(speed * timeDiff);
        npcPlayer.characterPhysics.applyWasd(v);
      } else {
        const v = new THREE.Vector3(-1, 0, 0)
          .multiplyScalar(walkSpeed * timeDiff);
        npcPlayer.characterPhysics.applyWasd(v);
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
