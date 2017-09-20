const async = require('async');
const fs = require('fs');
const log = require('simple-node-logger').createSimpleLogger('footbooker.log');

const connection = require('./connection.js');

'use-strict';

const settings = JSON.parse(fs.readFileSync('settings/foot_booker_settings.json'));

const timeout = 180000;
const retryTimeout = 3000;

/**
 * Convert to UTC date and time string is ISO format
 * 
 * <p>Times to book must be in UTC, even though the shown values are in local time.
 * 
 * @param {string} localDateAndTime string or other format of date and time
 * 
 * Return the converted string.
 */
function localToUTC(localDateAndTime) {
    let date = new Date(localDateAndTime);
    return new Date(date.getTime() + (date.getTimezoneOffset() * 60000)).toISOString();
}

/**
 * Convert to date in ISO format
 * 
 * <p>Useful for quering availability for a given date and time.
 * 
 * @param {string} localDateAndTime string or other format of date and time
 * 
 * Return the converted string.
 */
function dateAndTimeToDate(localDateAndTime) {
    let date = new Date(localDateAndTime);
    // Generates a date based in UTC, but when reading it is local
    date = new Date(date.toDateString());
    // Transforms in local
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
}

/**
 * Try to book for a specific date and time
 * 
 * <p>It is required to be loged in.
 * 
 * <p>If book is not available, an error will be thrown.
 * 
 * @param {string} localDateAndTime local date and time string in ISO format
 */
function tryToBook(localDateAndTime, callback) {
    let dateString = dateAndTimeToDate(localDateAndTime);
    let dateAndTimeUTC = localToUTC(localDateAndTime);
    connection.listAvailableBookings(dateString, (err, availableSessions) => {
        if (err) {
            return callback(err);
        }

        let guid;
        availableSessions.forEach((availableSession) => {
            if (new Date(availableSession.startTime).toISOString() === new Date(dateAndTimeUTC).toISOString()) {
                guid = availableSession.guid;
            }
        });
        
        if (guid) {
            // Session is available. Send book request.
            return connection.sendBookRequest(dateString, guid, callback);
        }

        // Session is not available
        return callback(new Error('Required session ' + localDateAndTime + 'is not available'));
    });
}

/**
 * Try to book in order for the dates and time in config until sucess or tried all
 * 
 * <p>It is required to be loged in.
 * 
 * Return the guid if succeeded.
 */
function tryToBookInOrder(callback) {
    let books = settings.bookingPreference;

    let bookedGuid;
    return async.eachSeries(books, (localDateAndTime, callback) => {
        if (bookedGuid) {
            // Already booked
            return callback();
        }
        log.log('info', 'Trying to book at ' + localDateAndTime);

        return tryToBook(localDateAndTime, (err, guid) => {
            if (err) {
                // If not succeeded, try next
                log.log('info', 'Booking for ' + localDateAndTime + ' failed: ' + err);
                return callback();
            }

            log.log('info', 'Booking for ' + localDateAndTime + ' succeeded: ' + guid);
            bookedGuid = guid;
            return callback();
        });
    }, (err) => {
        if (err) {
            // Should never happen here since errors in partial functions are ignored
            log.log('error', err);
            return callback(err);
        }

        if (!bookedGuid) {
            // Passed by all tries but none was successful
            return callback(new Error('None of the bookings was successful'));
        }

        return callback(null, bookedGuid);
    });
}

/**
 * Keep trying to book until success
 * 
 * <p>Try again each two seconds.
 */
function keepTryingToBook(callback) {
    let bookedGuid;
    async.whilst(() => {
        return !bookedGuid;
    }, (callback) => {
        setTimeout(() => {
            return tryToBookInOrder((err, guid) => {
                if (err) {
                    // Ignore and retry
                    log.log('warn', err);
                    return callback();
                }
    
                bookedGuid = guid;
                return callback();
            });
        }, retryTimeout);
    }, (err) => {
        if (err) {
            // Should never happen
            log.log('error', err);
            return callback(err);
        }

        return callback(null, bookedGuid);
    });
}

function perform() {
    async.waterfall([
        connection.getInitialCookies,
        connection.login,
        keepTryingToBook,
        connection.queryBookInformation
    ], (err, result) => {
        if (err) {
            log.error('error', err);
        } else {
            log.log('info', 'Result: ' + result);
        }
    });
}

let timer = setTimeout(() => {
    log.log('error', 'Timed out');
}, timeout);

perform();
clearTimeout(timer);