# IMPORTANTE — NÃO SOBRESCREVER SEM LER

## Mudança: mão esquerda visível na arma (two-handed grip)

### Arquivo alterado
- `src/game/firstPersonArms.ts`

### O que foi editado

1. **Visibilidade da mão esquerda** (linha ~84)
   - Antes: `playerLeftFistGroup.visible = !showWeapon || isEmoting || isPunchActive;`
   - Depois: `playerLeftFistGroup.visible = true;`
   - Motivo: a mão esquerda agora também aparece quando o jogador está com a arma equipada.

2. **Removido esconder mão esquerda dentro do bloco `showWeapon`** (linha ~99)
   - Antes: `playerLeftFistGroup.visible = false;`
   - Depois: removido.
   - Motivo: com a visibilidade sempre true, essa linha conflitava e deixava a mão invisível durante a mira.

3. **Adicionado posicionamento e curl da mão esquerda no grip** (após linha ~112)
   - Posição: `playerLeftFistGroup.position.set(-0.20, -0.22, -0.58);`
   - Rotação: `playerLeftFistGroup.rotation.set(0.30, 0.15, 0.25);`
   - Finger curls:
     ```
     thumb: 0.75
     index: 0.50
     middle: 0.70
     ring: 0.75
     pinky: 0.85
     ```
   - Motivo: simula a mão esquerda apoiando a arma pela frente/lado esquerdo, dando um grip de duas mãos.

### Observações para IA
- NÃO reverter a visibilidade da mão esquerda sem antes entender o propósito.
- Se for ajustar posição/rotação, manter a mão esquerda visível durante `showWeapon`.
- A posição atual funciona para pistol, shotgun e rifle. Se ajustar offsets de arma, validar se a mão esquerda continua alinhada.
