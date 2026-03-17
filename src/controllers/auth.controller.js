const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Génère un code numérique à 4 chiffres
 */
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * REGISTER
 * Rôles autorisés via l'API :
 * - user  (Pompiste)
 * - admin (Gérant, 1 seul autorisé)
 */
async function registerUser(req, res) {
  try {
    let { name, role, phone } = req.body;

    if (!name || !role || !phone) {
      return res.status(400).json({ success: false, message: 'Champs manquants' });
    }

    const roleMap = { user: 'user', admin: 'admin' };
    if (!roleMap[role]) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }

    role = roleMap[role];

    if (role === 'admin') {
      const adminCheck = await pool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
      if (adminCheck.rows.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Un seul Gérant (admin) est autorisé pour cette station.',
        });
      }
    }

    const plainCode = generateCode();
    const hashedCode = await bcrypt.hash(plainCode, 10);

    const query = `
      INSERT INTO users (name, role, phone, code)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, phone, role, created_at
    `;
    const values = [name, role, phone, hashedCode];
    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      code: parseInt(plainCode, 10),
      user: result.rows[0],
    });

  } catch (err) {
    console.error('REGISTER ERROR:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
}

/**
 * LOGIN (IDENTIFICATION PAR CODE UNIQUEMENT)
 * Plus besoin du téléphone, le système identifie l'utilisateur via son code unique.
 */
async function loginUser(req, res) {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Code d’accès requis' });
    }

    // 1. Récupérer tous les utilisateurs pour vérifier le code haché
    const result = await pool.query(`SELECT id, name, role, phone, code FROM users`);
    const users = result.rows;

    let identifiedUser = null;

    // 2. Comparaison du code saisi avec les hachages en base
    for (let user of users) {
      const isMatch = await bcrypt.compare(code.toString(), user.code);
      if (isMatch) {
        identifiedUser = user;
        break;
      }
    }

    if (!identifiedUser) {
      return res.status(401).json({
        success: false,
        message: 'Code incorrect ou utilisateur non reconnu.',
      });
    }

    // 3. Génération du token JWT
    const token = jwt.sign(
      { id: identifiedUser.id, role: identifiedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [identifiedUser.id]);

    return res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id: identifiedUser.id,
        name: identifiedUser.name,
        role: identifiedUser.role,
        phone: identifiedUser.phone
      },
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
}

/**
 * REGENERATE CODE (FORGOT)
 */
async function regenerateCode(req, res) {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Téléphone manquant' });
    }

    const plainCode = generateCode();
    const hashedCode = await bcrypt.hash(plainCode, 10);

    const result = await pool.query(
      `UPDATE users SET code = $1 WHERE phone = $2 RETURNING id`,
      [hashedCode, phone]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    return res.json({
      success: true,
      message: 'Nouveau code généré',
      code: parseInt(plainCode, 10),
    });

  } catch (err) {
    console.error('REGENERATE CODE ERROR:', err);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
  }
}

module.exports = {
  registerUser,
  loginUser,
  regenerateCode,
};