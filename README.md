# Prisme

Un mod pour [Claude Code](https://claude.com/claude-code) qui affiche en couleurs, dans un panneau à côté de la conversation, ce que Claude est en train de faire et le ton de ce qu'il écrit.

> *A Claude Code mod that shows, in a side pane, what Claude is doing right now (thinking, writing, reading, editing, running, browsing, delegating) and the lexical tone of its words. The interface is in French; tone detection covers both French and English.*

## Ce que montre le panneau

- **L'orbe** : le cœur prend la couleur de l'activité en cours, et l'anneau la répartition des signaux de ton du tour.
- **Le fil de l'activité** : une bande colorée des derniers segments (réflexion, écriture, appels d'outils), dont la largeur dépend de la durée et de la longueur. Au survol, on voit l'outil, la durée et un extrait.
- **Les signaux de ton du tour** : certitude, hésitation, vigilance, chaleur, remise en question, planification, curiosité.
- **La teinte des derniers tours** : une pastille par tour terminé, colorée par le mélange de ses signaux.

| Activité | Couleur |
| --- | --- |
| Réfléchit | violet |
| Écrit | bleu |
| Lit (Read, Grep, Glob…) | cyan |
| Modifie (Edit, Write…) | orange |
| Exécute (Bash, PowerShell…) | jaune |
| Navigue (WebSearch, WebFetch, navigateur) | vert |
| Délègue (Agent, SendMessage) | rose |

Le ton est une lecture du vocabulaire (des listes de mots en français et en anglais, comptés sur des mots entiers) et non un capteur d'émotions. Seul le texte visible est analysé : la réflexion affichée et les réponses de Claude. Les sous-agents sont ignorés.

Le panneau s'affiche dans le terminal, dans l'extension VS Code et dans l'application desktop.

## Installation

Dans une session Claude Code, depuis un terminal :

```
/plugin install prisme --marketplace mathieu-cozanet/claude-code-prisme
```

Réponds `y` pour ajouter la marketplace, puis choisis la portée (portée utilisateur par défaut, avec Entrée). Le mod est actif immédiatement.

Depuis un shell :

```
claude plugin install prisme --marketplace mathieu-cozanet/claude-code-prisme
```

Dans l'application desktop, où `/plugin` ne fonctionne pas : clique sur **+** à côté de la zone de saisie, puis **Plugins**, **Add marketplace** avec `mathieu-cozanet/claude-code-prisme`, puis **Add plugin**.

## Utilisation

Le panneau s'ouvre tout seul au démarrage d'une session. Pour le rouvrir après l'avoir fermé :

```
/prisme
```

Le bouton **Réinitialiser** vide le fil d'activité et l'historique des tours.

## Développement

```
claude --plugin-dir ./claude-code-prisme   # lancer une session avec le mod depuis ce dossier
claude plugin validate ./claude-code-prisme
claude plugin test ./claude-code-prisme
```

- `hooks/register.tsx` : le module (hooks `turn.step`, `tool.call` et `turn.complete`, plus le rendu du panneau)
- `types/index.d.ts` : le contrat des valeurs gardées dans `$.state`
- `hooks/prisme.test.tsx` : les tests

## Licence

MIT
