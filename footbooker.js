const https = require('https');
const async = require('async');
const fs = require('fs');

'use-strict';

const settings = JSON.parse(fs.readFileSync('foot_booker_settings.json'));
const timeout = 10000;
const footballId = '50ba1b7a-67f4-4c8d-a575-7dc8b5a43a30';

let cookies = {}

function setCookies(res) {
    res.headers['set-cookie']
        .map((s) => s.split(';')[0])
        .map((s) => s.split('='))
        .map((a) => {cookies[a[0]] = a[1]});
}

function getCookies() {
  let result = "";
  for (let key in cookies) {
    if (!cookies.hasOwnProperty(key)) continue;
    let value = cookies[key];
    result += `${key}=${value}; `
  }
  return result;
}

/**
 * Get and set the initial cookies.
 * 
 * "__cfduid" and "ASP.NET_SessionId" are set.
 */
function getInitialCookies(callback) {
    let req = https.request({
        hostname: 'hsp.kingscross.co.uk',
        path: '/Accounts/Login.aspx',
        method: 'GET'
    }, (res) => {
        setCookies(res);
        return callback();
    });

    req.on('error', (err) => {
        return callback(err);
    });

    req.end();
}

/**
 * Log in and set the cookies.
 * 
 * ".viciniteeFoms" is set.
 */
function login(callback) {
    let req = https.request({
        hostname: 'hsp.kingscross.co.uk',
        path: '/Services/Commercial/api/security/validatelogin.json',
        method: 'POST',
        headers: {
            'x-requested-with': 'XMLHttpRequest',
            'cookie': getCookies(),
            'content-type': 'application/json; charset=UTF-8'
        }
    }, (res) => {
        setCookies(res);
        return callback();
    });

    req.on('error', (err) => {
        return callback(err);
    });

    req.write(JSON.stringify({
        Email: settings.credentials.login,
        Password: settings.credentials.password,
        PersistCookie: true
    }));

    req.end();
}

/**
 * Get football id.
 * 
 * It is immutable.
 */
function getFootballId(callback) {
    let req = https.request({
        hostname: 'hsp.kingscross.co.uk',
        path: '/Services/Commercial/api/muga/listactivitytypes.json',
        method: 'POST',
        headers: {
            'x-requested-with': 'XMLHttpRequest',
            'cookie': getCookies(),
            'content-type': 'application/json; charset=UTF-8'
        }
    }, (res) => {
        let body = [];
        res.on('data', (chunk) => {
            body.push(chunk);
        });
        res.on('end', () => {
            body = Buffer.concat(body).toString();
            let dataJson = JSON.parse(body);
            let footballId;
            dataJson.Data.forEach((sport) => {
                if (sport.Name === 'Football') {
                    footballId = sport.Guid;
                }
            });
            return callback(null, footballId);
        });
        res.on('error', (err) => {
            return callback(err);
        });
    });

    req.on('error', (err) => {
        return callback(err);
    });

    req.end();
}

/**
 * Returns a list of available bookings in the format:
 * 
 * [ { Guid: 'id', Name: 'HSP session 1', StartDateTime: '2017-09-12T06:00:00.0000000Z', EndDateTime: '2017-09-12T06:45:00.0000000Z', Availability: -50 }
 * Where negative availability means not available.
 */
function listAvailableBookings(dateString, callback) {
    let req = https.request({
        hostname: 'hsp.kingscross.co.uk',
        path: '/Services/Commercial/api/muga/ListAvailableSessions.json',
        method: 'POST',
        headers: {
            'x-requested-with': 'XMLHttpRequest',
            'cookie': getCookies(),
            'content-type': 'application/json; charset=UTF-8'
        }
    }, (res) => {
        let body = [];
        res.on('data', (chunk) => {
            body.push(chunk);
        });
        res.on('end', () => {
            body = Buffer.concat(body).toString();
            let dataJson = JSON.parse(body);
            return callback(null, dataJson.Data);
        });
        res.on('error', (err) => {
            return callback(err);
        });
    });

    req.on('error', (err) => {
        return callback(err);
    });

    req.write(JSON.stringify({BookingDate: dateString, ActivityTypeGuid: footballId}));
    
    req.end();
}

/**
 * Returns the "Guid" of the booking if available and null otherwise.
 */
function isTimeAvailable(dateString, timeString, callback) {
    return async.waterfall([
        (callback) => {
            return listAvailableBookings(dateString, callback);
        },
        (availableSessions, callback) => {
            let guid;
            availableSessions.forEach((item) => {
                if (item.Availability >= 0 && item.StartDateTime === timeString) {
                    guid = item.Guid;
                }
            });
    
            return callback(null, dateString, guid);
        }
    ], callback);
}

/**
 * Send the request.
 */
function sendBookRequest(dateString, sessionGuid, callback) {
    let req = https.request({
        hostname: 'hsp.kingscross.co.uk',
        path: '/Services/Commercial/api/muga/AddBooking.json',
        method: 'POST',
        headers: {
            'x-requested-with': 'XMLHttpRequest',
            'cookie': getCookies(),
            'content-type': 'application/json; charset=UTF-8'
        }
    }, (res) => {
        return callback();
    });

    req.on('error', (err) => {
        return callback(err);
    });

    req.write(JSON.stringify({
        ActivityTypeGuid: footballId,
        SessionGuid: sessionGuid,
        Date: dateString
    }));
    
    req.end();
}

/**
 * Tries to book.
 */
function tryToBook(dateString, timeString, callback) {
    return async.waterfall([
        (callback) => {
            return isTimeAvailable(dateString, timeString, callback);
        },
        sendBookRequest
    ], callback);
}

/**
 * Query book information.
 */
// function queryBookInformation(guid, callback) {
//     let req = https.request({
//         hostname: 'hsp.kingscross.co.uk',
//         path: '/Services/Commercial/api/muga/GetBookingInformation.json',
//         method: 'POST',
//         headers: {
//             'x-requested-with': 'XMLHttpRequest',
//             'cookie': getCookies(),
//             'content-type': 'application/json; charset=UTF-8'
//         }
//     }, (res) => {
//         let body = [];
//         res.on('data', (chunk) => {
//             body.push(chunk);
//         });
//         res.on('end', () => {
//             body = Buffer.concat(body).toString();
//             let dataJson = JSON.parse(body);
//             return callback(null, dataJson.Data);
//         });
//         res.on('error', (err) => {
//             return callback(err);
//         });
//       }
//     );

//     req.on('error', (err) => {
//         return callback(err);
//     });

//     req.write(JSON.stringify({Guid: guid}));
    
//     req.end();
// }

function book(callback) {
    return async.waterfall([
        getInitialCookies,
        login,
        (callback) => {
            return tryToBook(settings.bookingPreference[0].date, settings.bookingPreference[0].time, callback);
        }
    ], callback);
}

book((err) => {
    if (err) {
        console.error(err);
    }
    console.log('success');
})