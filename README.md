# markdown-to-pdf-api

API HTTP minimaliste pour convertir du Markdown en PDF, avec option de stockage sur un bucket S3 (Clever Cloud Cellar).

Pensée pour être déployée sur Clever Cloud derrière un Otoroshi — pas de gestion d'authentification ni de rate limiting côté app.

## Stack

- Node.js ≥ 20 (JavaScript pur, pas de TypeScript)
- [Express](https://expressjs.com/)
- [marked](https://marked.js.org/) pour parser le Markdown
- [Puppeteer](https://pptr.dev/) pour le rendu PDF (Chromium headless)
- [@aws-sdk/client-s3](https://www.npmjs.com/package/@aws-sdk/client-s3) pour Cellar

## Endpoints

### `GET /health`

Healthcheck.

```json
{ "status": "ok" }
```

### `POST /convert`

Convertit un Markdown et renvoie le PDF en binaire.

**Request**

```http
POST /convert
Content-Type: application/json

{
  "markdown": "# Hello\n\nThis is **bold**."
}
```

**Response** — `application/pdf` (binaire)

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: inline; filename="document.pdf"
```

### `POST /convert-and-store`

Convertit le Markdown, stocke le PDF sur Cellar, renvoie une URL presigned (expiration configurable, 1h par défaut).

**Request**

```http
POST /convert-and-store
Content-Type: application/json

{
  "markdown": "# Hello",
  "filename": "rapport-2026-05.pdf"
}
```

Le champ `filename` est optionnel ; s'il est absent, un nom par défaut est utilisé. Le nom est sanitizé et préfixé d'un timestamp + d'un suffixe aléatoire pour éviter les collisions.

**Response** — `application/json`

```json
{
  "bucket": "my-bucket",
  "key": "pdf/2026-05-28T13-37-00-000Z-a1b2c3d4-rapport-2026-05.pdf",
  "url": "https://my-bucket.cellar-c2.services.clever-cloud.com/pdf/...?X-Amz-Signature=...",
  "expiresIn": 3600
}
```

## Configuration

Variables d'environnement (voir `.env.example`) :

| Variable | Description | Défaut |
|---|---|---|
| `PORT` | Port d'écoute HTTP | `8080` |
| `CELLAR_ADDON_HOST` | Hôte Cellar (injecté par l'addon Clever Cloud) | — |
| `CELLAR_ADDON_KEY_ID` | Access key Cellar (injectée) | — |
| `CELLAR_ADDON_KEY_SECRET` | Secret key Cellar (injectée) | — |
| `CELLAR_BUCKET` | Nom du bucket cible | — |
| `PRESIGNED_URL_EXPIRES_IN` | Durée de validité de l'URL presigned (secondes) | `3600` |
| `BODY_LIMIT` | Taille max du body JSON | `1mb` |
| `PDF_TIMEOUT_MS` | Timeout du rendu PDF | `30000` |

> Les `CELLAR_ADDON_*` sont injectées automatiquement quand l'addon Cellar est linké à l'application sur Clever Cloud. Seul `CELLAR_BUCKET` doit être défini manuellement.

## Développement local

```bash
npm install
cp .env.example .env   # renseigner les variables Cellar si tu veux tester /convert-and-store
npm run dev            # mode --watch
```

L'API écoute sur `http://localhost:8080` par défaut.

### Quick test

```bash
# Healthcheck
curl http://localhost:8080/health

# Convert → fichier PDF
curl -X POST http://localhost:8080/convert \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# Hello\n\nThis is **bold** and `code`."}' \
  --output out.pdf

# Convert and store → JSON avec URL presigned
curl -X POST http://localhost:8080/convert-and-store \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# Hello","filename":"hello.pdf"}'
```

## Déploiement sur Clever Cloud

1. **Créer l'application Node.js**
   ```bash
   clever create -t node markdown-to-pdf-api
   ```

2. **Créer et linker l'addon Cellar**
   ```bash
   clever addon create cellar-addon markdown-to-pdf-cellar
   clever service link-addon markdown-to-pdf-cellar
   ```
   Ça injecte automatiquement `CELLAR_ADDON_HOST`, `CELLAR_ADDON_KEY_ID`, `CELLAR_ADDON_KEY_SECRET`.

3. **Créer le bucket** depuis la console Cellar (ou via un client S3), puis :
   ```bash
   clever env set CELLAR_BUCKET <nom-du-bucket>
   ```

4. **Déployer**
   ```bash
   git push clever main
   ```

### Puppeteer / Chromium

Puppeteer télécharge sa propre version de Chromium pendant `npm install`. Pour que ce binaire soit conservé d'un déploiement à l'autre, le cache est configuré via `.puppeteerrc.cjs` pour pointer sur `./.cache/puppeteer` (à l'intérieur du dossier de l'app). Un script `postinstall` force le téléchargement au cas où il aurait été sauté.

Aucune env var supplémentaire à définir côté Clever Cloud pour Puppeteer.

## Notes

- L'instance Puppeteer (Chromium) est démarrée une fois au premier appel et réutilisée pour toutes les requêtes suivantes.
- Les erreurs renvoient un JSON `{ "error": "..." }` avec le bon code HTTP (`400` pour les inputs invalides, `500` pour les erreurs serveur).
- Aucune auth, aucun rate limit, aucun CORS : à gérer côté Otoroshi.
