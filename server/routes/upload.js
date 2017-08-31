const crypto = require('crypto');
const storage = require('../storage');
const config = require('../config');
const mozlog = require('../log');

const log = mozlog('send.upload');

// const validateIV = route_id => {
//   return route_id.match(/^[0-9a-fA-F]{24}$/) !== null;
// };

module.exports = function(req, res) {
  const newId = crypto.randomBytes(5).toString('hex');
  const metadata = req.header('X-File-Metadata');
  const auth = req.header('Authorization');
  if (!metadata || !auth) {
    return res.sendStatus(400);
  }

  // if (
  //   !meta.hasOwnProperty('id') ||
  //   !meta.hasOwnProperty('filename') ||
  //   !validateIV(meta.id)
  // ) {
  //   res.sendStatus(404);
  //   return;
  // }
  const meta = {
    delete: crypto.randomBytes(10).toString('hex'),
    metadata,
    pwd: 0,
    auth: auth.split(' ')[1],
    challenge: crypto.randomBytes(16).toString('base64')
  };
  req.pipe(req.busboy);

  req.busboy.on('file', async (fieldname, file) => {
    try {
      await storage.set(newId, file, meta);
      const protocol = config.env === 'production' ? 'https' : req.protocol;
      const url = `${protocol}://${req.get('host')}/download/${newId}/`;
      res.json({
        url,
        challenge: meta.challenge,
        delete: meta.delete,
        id: newId
      });
    } catch (e) {
      log.error('upload', e);
      if (e.message === 'limit') {
        return res.sendStatus(413);
      }
      res.sendStatus(500);
    }
  });

  req.on('close', async err => {
    try {
      await storage.forceDelete(newId);
    } catch (e) {
      log.info('DeleteError:', newId);
    }
  });
};
