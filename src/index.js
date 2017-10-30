const fs = require('fs');
const mergeJSON = require('merge-json');
const log = require('simple-node-logger').createSimpleLogger('footbooker.log');

const footbooker = require('./footbooker.js');

'use-strict';

const settingsFilePath = process.argv[2] ? process.argv[2] : 'settings/foot_booker_settings.json';
const existingSettings = JSON.parse(fs.readFileSync(settingsFilePath));

const settingsAdditions = {
    timeout: 180000,
    retryTimeout: 3000
};

const settings = mergeJSON.merge(settingsAdditions, existingSettings);

function perform() {
    switch (settings.strategy) {
        case "dateAndTimeOrder":
            return footbooker.dateAndTimeOrder(settings);
        case "weekdayAndTimeOrder":
            return footbooker.weekdayAndTimeOrder(settings);
        default:
            log.log('error', 'Invalid strategy');
    }
}

let timer = setTimeout(() => {
    log.log('error', 'Timed out');
}, settings.timeout);

perform();

clearTimeout(timer);
