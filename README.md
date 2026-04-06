# Studio of Beauty - Backend

Ce projet contient maintenant un backend Node.js + SQLite pour stocker les comptes utilisateurs.

## Installation

1. Installer Node.js (version 16+ recommandée).
2. Ouvrir le terminal dans le dossier du projet.
3. Exécuter :

```bash
npm install
```

## Démarrage

```bash
npm start
```

Le serveur démarre sur :

```bash
http://localhost:3000
```

## Comment voir les comptes inscrits

Visite cette URL dans le navigateur :

```bash
http://localhost:3000/admin/users?token=studioofbeauty_admin
```

Tu peux changer le token admin avec la variable d'environnement `ADMIN_TOKEN`.

## Notes importantes

- Le backend sert aussi les fichiers statiques du site.
- Le site doit être lancé avec le serveur Node pour que l'authentification fonctionne.
- GitHub Pages ne peut pas exécuter ce backend : il faut un hébergement Node ou un service cloud.
