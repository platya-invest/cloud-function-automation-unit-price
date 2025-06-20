#Guia de la cloud function pra automatizar el poceso de precio unitario que llega al correo

### 1. Ejecutar el archivo setup-gmail-auth.js

asegura de tener el archivo credentials.json es el authId y tener habilitado la api de gmail

```bash
npm run setup
```
Este comando se ejecuta solo la primera vez para cargar el token.json de autorizacion de Gmail.


## 🚀 Comandos de Despliegue

### Desarrollo/Default
```bash
npm run deploy
# o
firebase deploy --only functions
```

### QA
```bash
npm run deploy:qa
# o
NODE_ENV=qa firebase deploy --only functions --project qa
```

### Producción
```bash
npm run deploy:prod
# o
NODE_ENV=production firebase deploy --only functions --project prod
```

## 📋 Comandos de Logs

### Ver logs por entorno
```bash
# QA
npm run logs:qa

# Producción
npm run logs:prod

# Default
npm run logs
```

## 🔧 Variables de Entorno

El sistema detecta automáticamente el entorno basado en:

- `NODE_ENV=qa` → Entorno QA
- `NODE_ENV=production` → Entorno Producción
- Sin variable → Entorno por defecto (desarrollo)

## 📊 Monitoreo

Cada entorno guardará datos en:

- **QA**: `mpfi-qa-firestore-db`
- **Prod**: `mpfi-prod-firestore-db`
- **Default**: `mpfi-qa-firestore-db`

Los logs mostrarán claramente a qué entorno y base de datos se está conectando:

```
🔥 Conectando a Firebase entorno: production
📄 Base de datos: mpfi-prod-firestore-db
```