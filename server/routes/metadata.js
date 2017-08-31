const storage = require('../storage');
const crypto = require('crypto');

function validateID(route_id) {
  return route_id.match(/^[0-9a-fA-F]{10}$/) !== null;
}

module.exports = async function(req, res) {
  const id = req.params.id;
  if (!validateID(id)) {
    return res.sendStatus(404);
  }

  try {
    const auth = req.header('Authorization').split(' ')[1];
    const meta = await storage.metadata(id);
    const hmac = crypto.createHmac('sha256', Buffer.from(meta.auth, 'base64'));
    hmac.update(Buffer.from(meta.challenge, 'base64'));
    const verifyHash = hmac.digest();
    const challenge = crypto.randomBytes(16).toString('base64');
    storage.setField(id, 'challenge', challenge);
    if (!verifyHash.equals(Buffer.from(auth, 'base64'))) {
      res.set('WWW-Authenticate', `send-v1 ${challenge}`);
      return res.sendStatus(401);
    }
    const size = await storage.length(id);
    const ttl = await storage.ttl(id);
    res.send({
      metadata: meta.metadata,
      size,
      ttl,
      challenge
    });
  } catch (e) {
    res.sendStatus(404);
  }
};
