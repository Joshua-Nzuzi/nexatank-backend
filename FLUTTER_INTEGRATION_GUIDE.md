# NexaTank Backend - Guide d'intégration Flutter

**Document de référence pour le développement du frontend Flutter**

Version: 1.0  
Date: 17 mars 2026  
Destinataire: Développeur Flutter  

---

## 📋 Table des matières

1. [Architecture générale](#architecture-générale)
2. [Authentification](#authentification)
3. [Route Mesure de volume](#route-mesure-de-volume)
4. [Gestion des erreurs](#gestion-des-erreurs)
5. [Headers et sécurité](#headers-et-sécurité)
6. [Stockage local](#stockage-local)
7. [Flux utilisateur complet](#flux-utilisateur-complet)
8. [Configuration client HTTP](#configuration-client-http)
9. [Exemples de requêtes](#exemples-de-requêtes)
10. [Checklist d'implémentation](#checklist-dimplémentation)

---

## Architecture générale

### **Stack Backend**
- **Framework** : Express.js (Node.js)
- **Base de données** : PostgreSQL
- **Authentification** : JWT (8h d'expiration)
- **Port** : 3000 (development)
- **Base URL** : `http://localhost:3000` (dev) ou `https://api.nexatank.com` (prod)

### **Principes architecturaux**
- ✅ Authentification JWT obligatoire pour toutes les routes sensibles
- ✅ Cache en mémoire (TTL 60s) pour réduire charge BD
- ✅ Rate limiting : 100 requêtes/minute par utilisateur
- ✅ Compression gzip automatique des réponses
- ✅ Validation stricte des paramètres côté serveur

---

## Authentification

### **Flux authentification**

```
Utilisateur (phone + code 4 chiffres)
        ↓
   Register ou Login
        ↓
   Validation côté serveur
        ↓
   JWT généré (8h)
        ↓
   Toutes requêtes futures avec JWT
```

### **1. Register (Inscription)**

**Endpoint** : `POST /api/auth/users`

**Request** :
```json
{
  "name": "John Doe",
  "role": "user",          // "user" (pompiste) ou "admin" (gérant)
  "phone": "+243812345678"
}
```

**Response 201** (Succès) :
```json
{
  "success": true,
  "message": "Inscription réussie",
  "code": 1234,            // CODE À AFFICHER UNE FOIS SEULEMENT
  "user": {
    "id": 5,
    "name": "John Doe",
    "phone": "+243812345678",
    "role": "user",
    "created_at": "2026-03-17T10:30:00Z"
  }
}
```

**Comportement important** :
- ⚠️ **Code généré une seule fois** — À afficher immédiatement (copie possible)
- ⚠️ **Un seul admin autorisé** — Si `role: "admin"` et un admin existe déjà → 403
- ⚠️ **Code hashé en BD** — Non récupérable après (perdu = appeler Regenerate)

**Frontend** :
- Afficher code en **BIG, VISIBLE** (ex: 72pt font)
- Bouton "Copier le code"
- Text: "Notez ce code de sécurité. Il ne s'affichera qu'une fois."
- Button: "J'ai noté le code" → Aller à Login

---

### **2. Login (Connexion)**

**Endpoint** : `POST /api/auth/login`

**Request** :
```json
{
  "phone": "+243812345678",
  "code": "1234"
}
```

**Response 200** (Succès) :
```json
{
  "success": true,
  "message": "Connexion réussie",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // JWT 8h
  "user": {
    "id": 5,
    "name": "John Doe",
    "role": "user"
  }
}
```

**Response 401** (Code invalide) :
```json
{
  "success": false,
  "message": "Code invalide"
}
```

**Response 404** (User non trouvé) :
```json
{
  "success": false,
  "message": "Utilisateur non trouvé"
}
```

**Frontend** :
- Champs: Phone (input), Code (4 chiffres numériques seulement)
- Stocker JWT en **Secure Storage** (pas SharedPreferences simple)
- Stocker user info en SharedPreferences
- Rediriger vers Dashboard
- Gérer les 3 cas d'erreur différents

---

### **3. Regenerate Code (Mot de passe oublié)**

**Endpoint** : `PATCH /api/auth/users`

**Request** :
```json
{
  "phone": "+243812345678"
}
```

**Response 200** (Succès) :
```json
{
  "success": true,
  "message": "Nouveau code généré",
  "code": 5678             // Nouveau code à afficher
}
```

**Response 404** (User non trouvé) :
```json
{
  "success": false,
  "message": "Utilisateur non trouvé"
}
```

**Frontend** :
- Screen "Mot de passe oublié"
- Input: Phone
- Afficher nouveau code (même UX que Register)
- Rediriger vers Login

---

## Route Mesure de volume

### **Endpoint** : `POST /api/tanks/volume`

**Authentification** : ✅ JWT obligatoire (header `Authorization: Bearer <token>`)

**Request** :
```json
{
  "tank_id": 1,         // integer > 0, tank_id doit exister
  "depth_cm": 10.5      // number >= 0, profondeur en cm
}
```

**Headers requis** :
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

### **Réponses possibles**

#### **200 - Volume calculé (Succès)**
```json
{
  "success": true,
  "volume": 2500          // Litres (integer)
}
```

**Frontend** : Afficher "Volume: 2500 L" + sauvegarder en historique local

---

#### **200 - Volume non calculable**
```json
{
  "success": true,
  "volume": null,
  "message": "Charte vide"    // ou "Aucun volume mesurable" ou "Volume non pris en charge"
}
```

**Cas possibles** :
- `"Charte vide"` → Pas de données de calibrage pour ce tank
- `"Aucun volume mesurable"` → Profondeur = 0
- `"Volume non pris en charge"` → Profondeur hors limites de la charte

**Frontend** : Afficher le message à l'utilisateur + proposer nouvelle mesure

---

#### **400 - Paramètres invalides**
```json
{
  "success": false,
  "message": "tank_id invalide"    // ou "depth_cm invalide" ou "Paramètres manquants"
}
```

**Cas possibles** :
- `tank_id` manquant ou ≤ 0
- `depth_cm` manquant ou < 0
- Types invalides

**Frontend** : Valider côté client AVANT d'envoyer + afficher erreur utilisateur

---

#### **401 - JWT manquant/invalide**
```json
{
  "success": false,
  "message": "Accès refusé. Token manquant."    // ou "Token invalide ou expiré."
}
```

**Cas possibles** :
- Header `Authorization` absent
- Token expiré (8h)
- Token malformé

**Frontend** : 
- Rediriger vers Login
- Supprimer JWT + user info du stockage local
- Afficher: "Session expirée, reconnexion requise"

---

#### **404 - Tank non trouvé**
```json
{
  "success": false,
  "message": "Tank non trouvé"
}
```

**Frontend** : 
- Afficher: "Ce réservoir n'existe pas"
- Vérifier que l'utilisateur a les bons droits d'accès

---

#### **409 - Mesure dupliquée (< 1 seconde)**
```json
{
  "success": false,
  "message": "Une mesure avec le même timestamp existe déjà pour ce tank/utilisateur. Attendez au moins 1 seconde avant de réessayer.",
  "errorCode": "DUPLICATE_MEASUREMENT"
}
```

**Cas** : 2 mesures identiques envoyées dans la même seconde

**Frontend** :
- Afficher le message
- Proposer bouton "Réessayer dans 2 sec" (avec countdown)
- Ou attendre 1 sec puis retry automatiquement

---

#### **429 - Rate limit dépassé**
```json
{
  "success": false,
  "message": "Rate limit exceeded. Maximum 100 requests per minute allowed.",
  "retryAfter": 45
}
```

**Limite** : 100 requêtes/minute par utilisateur (toutes routes confondues)

**Frontend** :
- Afficher: "Vous avez dépassé la limite (100 req/min). Attendez 45 secondes."
- Afficher un countdown timer
- Bloquer les clics jusqu'à expiration
- Extraire `retryAfter` du header `X-RateLimit-Reset` pour plus de précision

**Headers rate limit** (retournés à chaque réponse) :
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 2026-03-17T10:35:30Z
```

---

#### **500 - Erreur serveur**
```json
{
  "success": false,
  "message": "Erreur serveur"
}
```

**Frontend** : 
- Afficher: "Erreur temporaire. Réessayez plus tard."
- Logger l'erreur (pour debug)
- Proposer bouton "Réessayer"

---

## Gestion des erreurs

### **Tableau de synthèse**

| Code HTTP | Cause | Action Frontend |
|-----------|-------|-----------------|
| **200** | Succès | Afficher résultat |
| **201** | Création réussie (Register) | Afficher code, passer à Login |
| **400** | Paramètres invalides | Afficher erreur, corriger inputs |
| **401** | JWT manquant/expiré | Logout, rediriger Login |
| **403** | Rôle insuffisant (ex: 2e admin) | Afficher "Accès refusé" |
| **404** | Ressource non trouvée (tank) | Afficher "Non trouvé", vérifier ID |
| **409** | Conflit (mesure dupliquée) | Attendre 1 sec, retry ou proposer bouton |
| **429** | Rate limit | Afficher countdown, bloquer clics |
| **500** | Erreur serveur | Afficher "Erreur temporaire", proposer retry |

### **Cas spéciaux à gérer**

1. **JWT expiré (401 + "Token invalide ou expiré")**
   - Ne pas afficher token expiré à l'utilisateur
   - Simplement: "Reconnexion requise"
   - Supprimer token + user local
   - Rediriger Login

2. **Network timeout**
   - Implémenter timeout 30s sur requêtes
   - Afficher: "Connexion perdue, réessayez"
   - Proposer retry

3. **Server down (500)**
   - Log l'erreur localement
   - Afficher message bienveillant
   - Proposer retry après 5s

---

## Headers et sécurité

### **Headers obligatoires (toutes requêtes)**

```
Content-Type: application/json
Authorization: Bearer <JWT>     // Pour routes authentifiées
```

### **Headers optionnels recommandés**

```
User-Agent: NexaTank-Flutter/1.0
Accept-Language: fr-FR
```

### **Headers retournés par le serveur**

```
X-RateLimit-Limit: 100                           // Max requêtes/min
X-RateLimit-Remaining: 87                        // Restantes
X-RateLimit-Reset: 2026-03-17T10:35:30Z         // Réinitialisation (ISO-8601)
Content-Encoding: gzip                           // Compression automatique
Content-Type: application/json
```

### **Règles de sécurité**

✅ **À faire** :
- JWT en header `Authorization` uniquement
- HTTPS en production (pas HTTP)
- Secure Storage pour JWT (Flutter Secure Storage)
- Valider JWT avant chaque requête sensible
- Gérer l'expiration (8h) et refresh proactif si besoin

❌ **À NE PAS faire** :
- JWT en URL ou query params
- JWT en SharedPreferences simple
- Phone/données sensibles en logs
- Révéler le token au client une 2e fois

---

## Stockage local

### **SharedPreferences** (données non sensibles)

```dart
final prefs = await SharedPreferences.getInstance();

// Stocker après login
await prefs.setInt('user_id', 5);
await prefs.setString('user_name', 'John Doe');
await prefs.setString('user_role', 'user');
await prefs.setString('user_phone', '+243812345678');

// Récupérer
int userId = prefs.getInt('user_id') ?? 0;
String userName = prefs.getString('user_name') ?? '';

// Supprimer (logout)
await prefs.remove('user_id');
await prefs.remove('user_name');
// ... etc
```

### **Secure Storage** (JWT)

```dart
import 'flutter_secure_storage/flutter_secure_storage.dart';

const storage = FlutterSecureStorage();

// Stocker JWT après login
await storage.write(
  key: 'jwt_token',
  value: token,
);

// Récupérer
String? token = await storage.read(key: 'jwt_token');

// Supprimer (logout)
await storage.delete(key: 'jwt_token');
```

### **Hive ou Sqflite** (historique mesures)

```dart
// Exemple structure mesure locale
class Measurement {
  final int tankId;
  final double depthCm;
  final int volumeLiters;
  final DateTime measuredAt;
}

// Sauvegarder après chaque mesure réussie
measurements.add(Measurement(
  tankId: 1,
  depthCm: 10.5,
  volumeLiters: 2500,
  measuredAt: DateTime.now(),
));

// Afficher historique (dernières 10)
List<Measurement> last10 = measurements.reversed.take(10).toList();
```

### **Memory Cache** (volumes calculés - 1 min TTL)

```dart
Map<String, dynamic> volumeCache = {};

// Vérifier cache
String cacheKey = 'vol:${tankId}:${depthCm}';
if (volumeCache.containsKey(cacheKey)) {
  int volume = volumeCache[cacheKey];
  // Utiliser du cache
}

// Sauvegarder en cache
volumeCache[cacheKey] = 2500;

// Optionnel: timer d'expiration
Future.delayed(Duration(minutes: 1), () {
  volumeCache.remove(cacheKey);
});
```

---

## Flux utilisateur complet

### **Démarrage de l'app**

```
App launch
  ↓
Check SharedPreferences pour 'user_id'
  ↓
  SI user_id existe ET JWT en Secure Storage
    ↓
    Vérifier JWT pas expiré (8h)
    ↓
    SI JWT valide → Aller Dashboard
    SINON → Supprimer JWT/user, Aller Login
  ↓
  SINON
    ↓
    Aller Login
```

### **Screen 1: Login**

```
Login Screen
  ├─ Inputs: phone, code (4 chiffres)
  ├─ Button: "Se connecter"
  │   ↓
  │   POST /api/auth/login
  │   ↓
  │   IF succès (200)
  │   ├─ Stocker JWT en Secure Storage
  │   ├─ Stocker user info en SharedPreferences
  │   └─ Rediriger Dashboard
  │   ↓
  │   IF erreur 401
  │   └─ Afficher "Code invalide"
  │   ↓
  │   IF erreur 404
  │   └─ Afficher "Utilisateur non trouvé"
  │
  └─ Link: "Nouveau compte?" → Screen Register
     Link: "Code oublié?" → Screen Forgot Password
```

### **Screen 2: Register**

```
Register Screen
  ├─ Inputs: name, role (dropdown), phone
  ├─ Button: "S'inscrire"
  │   ↓
  │   POST /api/auth/users
  │   ↓
  │   IF succès (201)
  │   ├─ Afficher code BIG (72pt)
  │   ├─ Button "Copier le code"
  │   ├─ Text: "Notez ce code, il ne s'affichera qu'une fois"
  │   └─ Button "J'ai noté" → Rediriger Login
  │   ↓
  │   IF erreur 400
  │   └─ Afficher erreur paramètres
  │   ↓
  │   IF erreur 403
  │   └─ Afficher "Un seul gérant autorisé"
  │
  └─ Link: "Déjà inscrit?" → Screen Login
```

### **Screen 3: Forgot Password**

```
Forgot Password Screen
  ├─ Input: phone
  ├─ Button: "Régénérer code"
  │   ↓
  │   PATCH /api/auth/users
  │   ↓
  │   IF succès (200)
  │   ├─ Afficher nouveau code BIG
  │   └─ Button "Aller à Login" → Rediriger Login
  │   ↓
  │   IF erreur 404
  │   └─ Afficher "Utilisateur non trouvé"
  │
  └─ Link: "Retour Login"
```

### **Screen 4: Dashboard (après login)**

```
Dashboard Screen
  ├─ Display: "Bienvenue, [user_name]"
  ├─ Display: "Rôle: [user_role]"
  ├─ Menu:
  │   ├─ Button: "Mesurer" → Screen Mesure
  │   ├─ Button: "Historique" → Screen Historique
  │   ├─ Button: "Profil" → Screen Profil
  │   └─ Button: "Déconnexion"
  │       ↓
  │       Supprimer JWT (Secure Storage)
  │       Supprimer user info (SharedPreferences)
  │       Rediriger Login
```

### **Screen 5: Mesure de volume**

```
Mesure Screen
  ├─ Inputs: tank_id, depth_cm
  ├─ Button: "Calculer volume"
  │   ↓
  │   Valider côté client (tank_id > 0, depth_cm >= 0)
  │   ↓
  │   Check cache local (cacheKey = "vol:${tankId}:${depthCm}")
  │   ├─ SI cache hit
  │   │   └─ Afficher volume direct (< 1ms)
  │   ├─ SINON
  │   │   ├─ POST /api/tanks/volume + JWT
  │   │   ├─ Sauvegarder en cache (TTL 1 min)
  │   │   └─ Afficher volume
  │   ↓
  │   IF succès (200 + volume)
  │   ├─ Afficher "Volume: 2500 L"
  │   ├─ Sauvegarder en historique local
  │   └─ Button: "Nouvelle mesure" ou "Retour menu"
  │   ↓
  │   IF succès (200 + null + message)
  │   ├─ Afficher message ("Charte vide", etc)
  │   └─ Proposer "Nouvelle mesure"
  │   ↓
  │   IF erreur 400
  │   └─ Afficher "Paramètres invalides"
  │   ↓
  │   IF erreur 401
  │   ├─ Afficher "Session expirée"
  │   └─ Rediriger Login
  │   ↓
  │   IF erreur 404
  │   └─ Afficher "Tank non trouvé"
  │   ↓
  │   IF erreur 409 (doublon)
  │   ├─ Afficher "Trop rapide, attendez 1 sec"
  │   ├─ Afficher countdown
  │   └─ Button: "Réessayer" (désactivé 1 sec)
  │   ↓
  │   IF erreur 429 (rate limit)
  │   ├─ Afficher "Trop de requêtes, attendez X sec"
  │   ├─ Afficher countdown (depuis X-RateLimit-Reset)
  │   └─ Bloquer tous les clics
  │   ↓
  │   IF erreur 500
  │   ├─ Afficher "Erreur serveur temporaire"
  │   └─ Button: "Réessayer dans 5 sec"
```

### **Screen 6: Historique**

```
Historique Screen
  ├─ Display: Liste dernières mesures (depuis Hive/Sqflite)
  │   ├─ Tank ID
  │   ├─ Profondeur
  │   ├─ Volume
  │   └─ Timestamp
  ├─ Button: "Exporter" (optionnel)
  └─ Link: "Retour menu"
```

---

## Configuration client HTTP

### **Exemple Dio (recommandé)**

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  static const String BASE_URL = 'http://localhost:3000'; // dev
  // static const String BASE_URL = 'https://api.nexatank.com'; // prod
  
  late Dio _dio;
  final _secureStorage = const FlutterSecureStorage();
  
  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: BASE_URL,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      contentType: 'application/json',
    ));
    
    // Ajouter interceptor JWT automatiquement
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Ajouter JWT à chaque requête
          final token = await _secureStorage.read(key: 'jwt_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onResponse: (response, handler) {
          // Logger les rate limits
          final remaining = response.headers.value('X-RateLimit-Remaining');
          if (remaining != null && int.parse(remaining) < 10) {
            print('⚠️ Rate limit warning: $remaining requêtes restantes');
          }
          return handler.next(response);
        },
        onError: (error, handler) {
          // Gérer 401 (JWT expiré)
          if (error.response?.statusCode == 401) {
            _handleUnauthorized();
          }
          return handler.next(error);
        },
      ),
    );
  }
  
  Future<void> _handleUnauthorized() async {
    // Supprimer JWT + user info
    await _secureStorage.delete(key: 'jwt_token');
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    
    // Rediriger Login (depuis context)
    // Navigation.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
  }
  
  // Requêtes d'exemple
  Future<Map> register(String name, String role, String phone) async {
    final response = await _dio.post(
      '/api/auth/users',
      data: {'name': name, 'role': role, 'phone': phone},
    );
    return response.data;
  }
  
  Future<Map> login(String phone, String code) async {
    final response = await _dio.post(
      '/api/auth/login',
      data: {'phone': phone, 'code': code},
    );
    return response.data;
  }
  
  Future<Map> regenerateCode(String phone) async {
    final response = await _dio.patch(
      '/api/auth/users',
      data: {'phone': phone},
    );
    return response.data;
  }
  
  Future<Map> calculateVolume(int tankId, double depthCm) async {
    final response = await _dio.post(
      '/api/tanks/volume',
      data: {'tank_id': tankId, 'depth_cm': depthCm},
    );
    return response.data;
  }
}
```

### **Utilisation**

```dart
final apiClient = ApiClient();

// Register
try {
  final result = await apiClient.register('John Doe', 'user', '+243812345678');
  if (result['success']) {
    print('Code: ${result['code']}');
  }
} on DioException catch (e) {
  print('Error: ${e.response?.statusCode} - ${e.response?.data['message']}');
}

// Login
try {
  final result = await apiClient.login('+243812345678', '1234');
  if (result['success']) {
    final token = result['token'];
    await secureStorage.write(key: 'jwt_token', value: token);
  }
} on DioException catch (e) {
  // Gérer erreurs
}

// Mesure volume
try {
  final result = await apiClient.calculateVolume(1, 10.5);
  if (result['success'] && result['volume'] != null) {
    print('Volume: ${result['volume']} L');
  }
} on DioException catch (e) {
  // Gérer erreurs
}
```

---

## Exemples de requêtes

### **cURL (pour tester rapidement)**

#### Register
```bash
curl -X POST http://localhost:3000/api/auth/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "role": "user",
    "phone": "+243812345678"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+243812345678",
    "code": "1234"
  }'
```

#### Mesure de volume (avec JWT)
```bash
JWT_TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X POST http://localhost:3000/api/tanks/volume \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "tank_id": 1,
    "depth_cm": 10.5
  }'
```

#### Regenerate Code
```bash
curl -X PATCH http://localhost:3000/api/auth/users \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+243812345678"
  }'
```

---

## Checklist d'implémentation

### **Phase 1: Authentification**

- [ ] Screen Login (phone + code)
- [ ] Screen Register (name + role + phone)
- [ ] Screen Forgot Password (phone)
- [ ] Stocker JWT en Secure Storage
- [ ] Stocker user info en SharedPreferences
- [ ] Interceptor HTTP pour ajouter JWT automatiquement
- [ ] Gérer 401 (rediriger Login + supprimer token)
- [ ] Gestion logout (supprimer JWT + user info)
- [ ] Check JWT à startup de l'app

### **Phase 2: Mesure de volume**

- [ ] Screen Mesure (inputs tank_id, depth_cm)
- [ ] Validation côté client avant envoi
- [ ] POST /api/tanks/volume + JWT
- [ ] Afficher volume en réponse
- [ ] Sauvegarder mesure en historique local (Hive/Sqflite)
- [ ] Cache local des volumes (1 min TTL)
- [ ] Gestion 200 (afficher volume)
- [ ] Gestion 200 + null (afficher message)
- [ ] Gestion 404 (tank non trouvé)
- [ ] Gestion 409 (doublon, afficher countdown + retry)
- [ ] Gestion 429 (rate limit, afficher countdown)
- [ ] Gestion 500 (erreur serveur, proposer retry)

### **Phase 3: UI/UX**

- [ ] Screen Dashboard (menu principal)
- [ ] Screen Historique (dernières mesures)
- [ ] Toast/Snackbar pour confirmations
- [ ] Loaders pendant requêtes HTTP
- [ ] Validation des inputs utilisateur
- [ ] Messages d'erreur clairs
- [ ] Countdown timers visuels (409, 429)
- [ ] Dark mode support (optionnel)

### **Phase 4: Robustesse**

- [ ] Gestion network timeouts
- [ ] Retry automatique pour 429 (rate limit)
- [ ] Retry manuel pour 500 (erreur serveur)
- [ ] Logging des erreurs (Sentry, Firebase Crashlytics)
- [ ] Tests unitaires (API client)
- [ ] Tests d'intégration (flows complets)
- [ ] Tests de performance (cache, local storage)

### **Phase 5: Production**

- [ ] Changer BASE_URL vers `https://api.nexatank.com`
- [ ] Mettre à jour secrets (JWT_SECRET côté serveur si changé)
- [ ] Tester sur device réel
- [ ] Tester en offline (et reconnexion)
- [ ] Tester sous faible connexion (throttle 3G)
- [ ] Code coverage > 80%
- [ ] Release build (obfuscation)
- [ ] Déploiement PlayStore/AppStore

---

## Notes importantes

### **Sécurité**
- ⚠️ **Jamais** mettre JWT en logs/debugger
- ⚠️ **Jamais** passer JWT en URL ou query params
- ✅ **Toujours** utiliser Secure Storage pour JWT
- ✅ **Toujours** valider entrées utilisateur côté client

### **Performance**
- ✅ Cache les volumes (TTL 60s)
- ✅ Sauvegarde historique en local (pas en temps réel depuis le serveur)
- ✅ Compresse les images avant d'envoyer (future feature)
- ✅ Lazy load l'historique (pagination ou infinite scroll)

### **UX**
- ✅ Afficher loaders pendant requêtes
- ✅ Afficher X-RateLimit-Remaining au besoin (opt)
- ✅ Countdown visuel pour 409 + 429
- ✅ Messages d'erreur en français, simples et clairs
- ✅ Boutons "Réessayer" / "Retour" visibles

### **Testing**
- ✅ Tester sur device réel
- ✅ Tester offline mode
- ✅ Tester réseau lent (3G throttle)
- ✅ Tester JWT expiration (8h)
- ✅ Tester rate limit (envoi 101 requêtes)

---

## Support & Questions

Pour toute question sur le backend ou API:
- Consulter ce document
- Vérifier la structure des réponses (codes HTTP)
- Tester avec cURL avant d'implémenter en Flutter
- Vérifier les logs du serveur (si accès)

---

**Document généré**: 17 mars 2026  
**Version Backend**: 1.0  
**Auteur**: Développement NexaTank Backend  

---

