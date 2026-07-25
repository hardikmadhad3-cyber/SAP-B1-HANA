const express = require('express');
const relationshipMapController = require('../controllers/relationshipMapController');

const router = express.Router();

router.get('/:objectType/:docEntry', relationshipMapController.getRelationshipMap);

module.exports = router;
