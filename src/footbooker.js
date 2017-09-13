const async = require('async');
const fs = require('fs');

const connection = require('./connection.js')

'use-strict';

const settings = JSON.parse(fs.readFileSync('settings/foot_booker_settings.json'));


// TODO: functions like the ones below to really book based on connection
// function bla() {
//     async.waterfall([
//         connection.getInitialCookies,
//         connection.login,
//         (callback) => {
//             // connection.listAvailableBookings('2017-09-18T00:00:00.000Z', callback);
//             // connection.sendBookRequest('2017-09-18T00:00:00.000Z', '069eb766-bc03-4664-ad7f-cf1b18a65f56', callback); // not
//             // connection.sendBookRequest('2017-09-18T00:00:00.000Z', 'caaf36c9-c092-4c4f-995b-e247e22ed8e2', callback); // av
//             connection.queryBookInformation('e852a824-d429-4748-ac7d-be29f48470f8', callback);
//         }
//     ], (err, result) => {
//         if (err) {
//             console.error(err);
//         } else {
//             console.log(result);
//         }
//     });
// }

// bla();
// setTimeout(() => {
//     console.error('Timed out');
// }, 10000);