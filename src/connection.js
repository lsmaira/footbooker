const https = require('https');
const fs = require('fs');

'use-strict';

const settings = JSON.parse(fs.readFileSync('settings/foot_booker_settings.json'));

const footballId = '50ba1b7a-67f4-4c8d-a575-7dc8b5a43a30';

let cookies = {}

/**
 * Set the cookies for a given response if there are any
 */
function setCookies(res) {
    if (res.headers['set-cookie']) {
        res.headers['set-cookie']
            .map((s) => s.split(';')[0])
            .map((s) => s.split('='))
            .map((a) => {cookies[a[0]] = a[1]});
    }
}

/**
 * Get all previously set cookies in string format
 */
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
 * Send a request to the given path with the given payload
 * 
 * Return the response body and sets new cookies.
 */
function sendRequest(path, method, payload, callback) {
    let req = https.request({
        hostname: settings.hostname,
        path: path,
        method: method,
        headers: {
            cookie: getCookies()
        }
    }, (res) => {
        setCookies(res);

        let body = [];
        res.on('data', (chunk) => {
            body.push(chunk);
        });
        res.on('end', () => {
            body = Buffer.concat(body).toString();
            return callback(null, body);
        });
        res.on('error', (err) => {
            return callback(err);
        });
    });

    req.on('error', (err) => {
        return callback(err);
    });

    if (payload) {
        req.write(payload);
    }

    req.end();
}

/**
 * Get and set the initial cookies
 *
 * <p>'__cfduid' and 'ASP.NET_SessionId' are set.
 */
function getInitialCookies(callback) {
    return sendRequest('/Accounts/Login.aspx', 'GET', null, (err, body) => {
        callback(err);
    });
}

/**
 * Log in and set the cookies
 *
 * <p>'.viciniteeFoms' is set.
 */
function login(callback) {
    return sendRequest(
        '/Services/Commercial/api/security/validatelogin.json',
        'POST',
        JSON.stringify({
            Email: settings.credentials.login,
            Password: settings.credentials.password,
            PersistCookie: true
        }),
        (err, body) => {
            if (err) {
                return callback(err);
            }

            let data = JSON.parse(body);
            
            // Expected failure message:
            // {Code: 401, Message: 'Email or password was not recognised, please try again'}
            if (data.Code !== 200) {
                return callback(new Error('Login failed: ' + JSON.stringify(data)));
            }

            // Expected sucess message: {Code:200, Message: 'Success'}
            return callback();
        }
    );
}


/**
 * Get sport id
 *
 * <p>Id should be immutable, no need to get it every time.
 * 
 * Return the id.
 */
function getFootballId(callback) {
    return sendRequest(
        '/Services/Commercial/api/muga/listactivitytypes.json',
        'POST',
        null,
        (err, body) => {
            if (err) {
                return callback(err);
            } else {
                let data = JSON.parse(body);

                if (data.Code !== 200) {
                    return callback(new Error('Get football id failed: ' + JSON.stringify(data)));
                }
                
                // Expected response:
                // {
                //     Code: 200,
                //     Data: [
                //         {Guid: 'c4ce9ac3-784c-408d-ad60-0366b9327d2e', Name: 'Badminton'},
                //         {Guid: 'c7e1e579-d72e-4ff0-8010-4a13e5ca33d0', Name: 'Basketball'},
                //         {Guid: 'aa62c2f1-19a8-4e80-ace9-80f8d5aad2aa', Name: 'Basketball half court (8 or less players)'},
                //         {Guid: '50ba1b7a-67f4-4c8d-a575-7dc8b5a43a30', Name: 'Football'},
                //         {Guid: '069d9a11-c407-48c2-9a5c-0bba926823b2', Name: 'Football half court'},
                //         {Guid: 'f6048bab-ad80-4308-8fa3-5a03fabc8b4f', Name: 'Netball'},
                //         {Guid: 'c2ad46e9-58c3-4b54-9c20-8306deead2a6', Name: 'Netball half court (8 or less players)'}
                //     ]
                // }
                let footballId;
                data.Data.forEach((sport) => {
                    if (sport.Name === 'Football') {
                        footballId = sport.Guid;
                    }
                });

                if (footballId) {
                    return callback(null, footballId);
                }

                return callback(new Error('Get football id failed: could not find Football in ' + JSON.stringify(data.Data)));
            }
        }
    );
}

/**
 * Obtain a list of available bookings for a given date
 * 
 * @param {string} dateString date in ISO format. Must be like '2017-09-17T00:00:00.000Z'.
 * 
 * Return an array of available sessions in format [{guid: 'string guid', startTime: 'start date and time in ISO'}].
 */
function listAvailableBookings(dateString, callback) {
    return sendRequest(
        '/Services/Commercial/api/muga/ListAvailableSessions.json',
        'POST',
        JSON.stringify({
            BookingDate: dateString,
            ActivityTypeGuid: footballId
        }),
        (err, body) => {
            if (err) {
                return callback(err);
            }

            let data = JSON.parse(body);

            // Expected error message if date is too far:
            // {Code: 500, Message: 'Unknown Error Occurred'}
            // Expected error message if string is not a date ISO or sport id not found:
            // {Code: 500, Message: 'The parameters specified are not valid'}
            if (data.Code !== 200) {
                return callback(new Error('List available bookings failed: ' + JSON.stringify(data)));
            }

            // Expected success message:
            // {
            //     Code: 200,
            //     Data: [
            //         {Guid: '069eb766-bc03-4664-ad7f-cf1b18a65f56', Name: 'HSP session 1', StartDateTime: '2017-09-17T08:00:00.0000000Z', EndDateTime: '2017-09-17T08:45:00.0000000Z', Availability: 0},
            //         {Guid: '03214d86-50e1-43eb-bd66-78b375c05b6d', Name: 'HSP session 2', StartDateTime: '2017-09-17T09:00:00.0000000Z', EndDateTime: '2017-09-17T09:45:00.0000000Z', Availability: -100},
            //         ...
            //         {Guid: 'b77ec9fd-6048-4fd6-a6d5-b2166d55e527', Name: 'HSP session 11', StartDateTime: '2017-09-17T18:00:00.0000000Z', EndDateTime: '2017-09-17T18:45:00.0000000Z', Availability: -50}
            //     ]
            // }
            let availables = [];
            data.Data.forEach((session) => {
                if (session.Availability >= 0) {
                    availables.push({guid: session.Guid, startTime: session.StartDateTime});
                }
            });
            return callback(null, availables);
        }
    );
}

/**
 * Send the request for a given date and slot
 * 
 * @param {string} dateString date in ISO format. Must be like '2017-09-17T00:00:00.000Z'.
 * @param {string} sessionGuid string obtained in listAvailableBookings.
 * 
 * Return the guid of the booking.
 */
function sendBookRequest(dateString, sessionGuid, callback) {
    return sendRequest(
        '/Services/Commercial/api/muga/AddBooking.json',
        'POST',
        JSON.stringify({
            ActivityTypeGuid: footballId,
            Date: dateString,
            SessionGuid: sessionGuid
        }),
        (err, body) => {
            if (err) {
                return callback(err);
            }

            let data = JSON.parse(body);
            
            // Expected error message if slot is not available:
            // {Code: 500, Message: 'Sorry, There is no space left to complete the booking. Please refresh the page and try again'}
            // Expected error message if sport id, session id or date string is wrong:
            // {Code: 500, Message: 'The parameters specified are not valid'}
            // Expected error message if date is too far:
            // {Code: 500, Message: 'Unknown Error Occurred'}
            if (data.Code !== 200) {
                return callback(new Error('Send book request failed: ' + JSON.stringify(data)));
            }

            // Expected success message:
            // {Code: 200, Data: {Guid: '8b525b11-b02a-4317-89d0-69491265c603'}}
            return callback(null, data.Data.Guid);
        }
    );
}

/**
 * Query book information
 * 
 * @param {string} guid guid of the booking.
 * 
 * Return book information in format:
 * {
 *      Guid: 'e852a824-d429-4748-ac7d-be29f48470f8',
 *      StartDateTime: '2017-09-18T07:00:00.0000000Z',
 *      EndDateTime: '2017-09-18T07:45:00.0000000Z',
 *      ActivityName: 'Football',
 *      Description: null,
 *      PersonGuid: null
 * }
 */
function queryBookInformation(guid, callback) {
    return sendRequest(
        '/Services/Commercial/api/muga/GetBookingInformation.json',
        'POST',
        JSON.stringify({Guid: guid}),
        (err, body) => {
            if (err) {
                return callback(err);
            }
            
            let data = JSON.parse(body);

            // Expected error message if invalid guid:
            // {Code: 500, Message: 'The parameters specified are not valid'}
            if (data.Code !== 200) {
                return callback(new Error('Query book information failed: ' + JSON.stringify(data)));
            }

            // Expected success message:
            // {
            //     Code: 200,
            //     Data: {
            //         Guid: 'e852a824-d429-4748-ac7d-be29f48470f8',
            //         StartDateTime: '2017-09-18T07:00:00.0000000Z',
            //         EndDateTime: '2017-09-18T07:45:00.0000000Z',
            //         ActivityName: 'Football',
            //         Description: null,
            //         PersonGuid: null
            //     }
            // }
            return callback(null, data.Data);
        }
    );
}

/**
 * Obtain a list of all booked sessions
 * 
 * Return an array of all booked sessions in format:
 * [{
 *      Guid: 'e852a824-d429-4748-ac7d-be29f48470f8',
 *      StartDateTime: '2017-09-18T07:00:00.0000000Z',
 *      EndDateTime: '2017-09-18T07:45:00.0000000Z',
 *      ActivityName: 'Football',
 *      Description: 'Your Name',
 *      PersonGuid: 'b44e80a6-3bca-4717-b6f0-ddf077a947b8'
 * }]
 */
function listBookedSessions(callback) {
    return sendRequest(
        '/Services/Commercial/api/muga/list.json',
        'POST',
        JSON.stringify({
            BookingDate: null
        }),
        (err, body) => {
            if (err) {
                return callback(err);
            }

            let data = JSON.parse(body);
            
            if (data.Code !== 200) {
                return callback(new Error('List booked sessions failed: ' + JSON.stringify(data)));
            }

            // Expected success message:
            // {
            //     Code: 200,
            //     Data: [
            //         {
            //             Guid: 'e852a824-d429-4748-ac7d-be29f48470f8',
            //             StartDateTime: '2017-09-18T07:00:00.0000000Z',
            //             EndDateTime: '2017-09-18T07:45:00.0000000Z',
            //             ActivityName: 'Football',
            //             Description: 'Your Name',
            //             PersonGuid: 'b44e80a6-3bca-4717-b6f0-ddf077a947b8'
            //         },
            //         {
            //             Guid: 'e852a824-d429-4748-ac7d-be29f48470f8',
            //             StartDateTime: '2017-09-19T07:00:00.0000000Z',
            //             EndDateTime: '2017-09-19T07:45:00.0000000Z',
            //             ActivityName: 'Football',
            //             Description: 'Your Name',
            //             PersonGuid: 'b44e80a6-3bca-4717-b6f0-ddf077a947b8'
            //         }
            //     ]
            // }
            return callback(null, data.Data);
        }
    );
}

module.exports = {
    getInitialCookies: getInitialCookies,
    login: login,
    getFootballId: getFootballId,
    listAvailableBookings: listAvailableBookings,
    sendBookRequest: sendBookRequest,
    queryBookInformation: queryBookInformation,
    listBookedSessions: listBookedSessions
}