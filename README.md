# SUIVICOMER — SaaS de Gestion des Bons et de Suivi des Chargements

Application SaaS multi-utilisateurs professionnelle, offline-first et mobile, conçue pour les **agréés de carrières**, leurs **secrétaires** et leurs **commerciaux**.

---

## 🛡️ Règle d'Indépendance Absolue

Ce projet est **100% indépendant** d'AGRÉPILOT :
- Aucun fichier partagé avec AGRÉPILOT.
- Aucune connexion à la base de données Supabase d'AGRÉPILOT.
- Aucune réutilisation de clés API ou secrets d'AGRÉPILOT.
- Dépôt GitHub et projet Vercel dédiés.

---

## 🏗️ Architecture Technique

- **Frontend** : React 19, TypeScript, Vite 6.
- **Styling** : Design System moderne en Vanilla CSS avec tokens personnalisés, optimisé pour terminaux mobiles et environnements de chantier/carrière (boutons larges ≥ 44px, contraste élevé).
- **Mode Hors Ligne & PWA** :
  - **Service Worker** (`public/sw.js`) avec cache des assets statiques.
  - **IndexedDB** (`src/services/offlineDb.ts`) pour la persistance locale totale des bons, chargements, commerciaux et file d'attente.
  - **Moteur de Synchronisation** (`src/services/syncEngine.ts`) avec génération d'identifiants uniques `sync_id`, réservation locale des bons (anti-double utilisation hors ligne), absorption des doublons (idempotence) et détection/résolution des conflits serveur.
- **Backend & Base de Données** :
  - Supabase PostgreSQL avec Row Level Security (RLS) étanche.
  - Fonctions stockées transactionnelles (`attribute_bon_range`, `record_loading`, `update_loading_payment`).
  - Migration versionnée : `supabase/migrations/20261016000001_initial_schema.sql`.
- **Tests** : Suite de tests automatisés Vitest (`npm test`) validant les 20 exigences non négociables.

---

## 👥 Rôles et Autorisations

| Rôle | Accès & Droits | Restrictions |
|---|---|---|
| **Agréé** (Propriétaire) | Dashboard global KPIs, ajout/activation commerciaux, gestion secrétaires et permissions, attribution plages de bons, consultation tous chargements/paiements, modification règlements. | Restreint aux données de sa propre entreprise. |
| **Secrétaire** | Saisie rapide des chargements, sélection commercial et bon disponible, mise à jour des paiements (si autorisé par l'agréé). | Ne peut pas attribuer de plages ni modifier les membres. |
| **Commercial** | Espace strictement personnel : ses bons attribués/utilisés/disponibles, ses chargements, ses soldes payés/restants. | **Strictement interdit** : voir les chargements des collègues, modifier les paiements, attribuer des bons. |

---

## 🚀 Démarrage Local Rapide

```powershell
# 1. Cloner ou ouvrir le dossier
cd c:\Users\USER\suivicomer

# 2. Installer les dépendances (déjà fait)
npm install

# 3. Lancer les tests de conformité (20/20 validés)
npm test

# 4. Lancer le serveur de développement
npm run dev
```

> **Note :** L'application intègre un sélecteur d'accès rapide permettant de tester immédiatement les 3 rôles (**Agréé**, **Secrétaire**, **Commercial**) en mode démo local, même sans avoir encore connecté de projet Supabase externe !

---

## ⚙️ Configuration Supabase pour la Production

1. Connectez-vous sur votre console [Supabase](https://app.supabase.com).
2. Cliquez sur **New Project** :
   - Nom : `suivicomer-prod` (ou le nom de votre choix).
   - Région : `eu-west-1` ou région la plus proche de vos utilisateurs.
3. Allez dans **SQL Editor** et exécutez le script complet situé dans :
   [`supabase/migrations/20261016000001_initial_schema.sql`](file:///c:/Users/USER/suivicomer/supabase/migrations/20261016000001_initial_schema.sql)
4. Récupérez l'URL du projet et la clé publique `anon` dans **Project Settings > API**.
5. Renseignez-les dans votre fichier `.env` ou sur votre hébergeur :
   ```env
   VITE_SUPABASE_URL=https://votre-projet.supabase.co
   VITE_SUPABASE_ANON_KEY=votre_cle_anon_publique
   ```

---

## 🌐 Déploiement sur Vercel

1. Créez un nouveau projet sur Vercel lié à votre nouveau dépôt GitHub `suivicomer`.
2. Framework Preset : **Vite**.
3. Build Command : `npm run build`.
4. Output Directory : `dist`.
5. Ajoutez les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
6. Le fichier `vercel.json` configuré assure le routing SPA sans erreur 404 lors des rafraîchissements.
