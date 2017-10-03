const fs = require('fs');
const mergeJSON = require('merge-json');

'use-strict';

const template = {
    credentials: {
        login: 'email@host.com',
        password: 'password'
    },
    hostname: 'the.site.co.uk',
    strategy: 'oneOfTheOptionsBelow',
    dateAndTimeOrder: {
        bookingPreference: [
            '2017-10-11T20:00:00.0000000Z',
            '2017-10-11T23:00:00.0000000Z',
            '2017-10-11T19:00:00.0000000Z',
            '2017-10-11T18:00:00.0000000Z'
        ]
    }
};

const settingsDir = 'settings';
const settingsPath = 'settings/foot_booker_settings.json';

/**
 * Generate settings file from template
 * 
 * <p>If settings file already exists, it is merged to the template, prioritizing
 * the already existing properties.
 * </p>
 * 
 * <p>If settings directory doesn't exist yet, it is created.
 */
function generateSettings() {
    if (!fs.existsSync(settingsDir)){
        fs.mkdirSync(settingsDir);
    }

    let existingSettings = {};
    if (fs.existsSync(settingsPath)) {
        existingSettings = JSON.parse(fs.readFileSync(settingsPath));
    }

    fs.writeFileSync(settingsPath, JSON.stringify(mergeJSON.merge(template, existingSettings), null, 4));
}

generateSettings();