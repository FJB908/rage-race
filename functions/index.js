'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const H = require('./handlers');

admin.initializeApp();
const db = admin.firestore();
const store = {
    async get(path) { const s = await db.doc(path).get(); return s.exists ? s.data() : null; },
    async set(path, data) { await db.doc(path).set(data); },
};
const OPTS = { region:'europe-west1', maxInstances:10 };
const wrap = fn => async req => {
    try { return await fn(store, req.auth && req.auth.uid, req.data, Date.now()); }
    catch (e) { if (e instanceof H.Reject) throw new HttpsError('failed-precondition', e.code); console.error(e); throw new HttpsError('internal', 'error'); }
};

// Ranked: the server owns MMR / rank points. The phone asks for a match id, then reports the result.
exports.rankedStart = onCall(OPTS, wrap(H.start));
exports.rankedFinish = onCall(OPTS, wrap(H.finish));
