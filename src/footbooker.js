const async = require('async');
const log = require('simple-node-logger').createSimpleLogger('footbooker.log');

const connection = require('./connection.js');
const utils = require('./utils.js');

'use-strict';

/**
 * Try to book a certain date and time given a list of availability
 * 
 * <p>It is required to be loged in.
 * 
 * @param {string} dateAndTime the date and time string. If contains no time zone, it will be considered local.
 * @param {Object} availableSessions available sessions for the given date, in format:
 * [{guid: 'string guid', startTime: 'start date and time in ISO'}].
 * 
 * Return the guid, as a string, if suceeded.
 */
function tryToBookGivenAvailability(dateAndTime, availableSessions, callback) {
    let isoDateAndTime = utils.localOrISOToISO(dateAndTime);
    let isoDateString = utils.dateAndTimeOrDateToDate(isoDateAndTime);
    let guid;
    availableSessions.forEach((availableSession) => {
        if (new Date(availableSession.startTime).toISOString() === new Date(isoDateAndTime).toISOString()) {
            guid = availableSession.guid;
        }
    });
    
    if (guid) {
        // Session is available. Send book request.
        return connection.sendBookRequest(isoDateString, guid, callback);
    }

    // Session is not available
    return callback(new Error('Required session ' + isoDateAndTime + 'is not available'));
}

/**
 * Obtain the list of available sessions and try to book
 * 
 * <p>It is required to be loged in.
 * 
 * @param {string} dateAndTime the date and time string. If contains no time zone, it will be considered local.
 * 
 * Return the guid, as a string, if suceeded.
 */
function checkAvailabilityAndTryToBook(dateAndTime, callback) {
    let isoDateString = utils.dateAndTimeOrDateToDate(dateAndTime);
    return async.waterfall([
        (callback) => {
            return connection.listAvailableBookings(isoDateString, callback);
        },
        (availableSessions, callback) => {
            return tryToBookGivenAvailability(dateAndTime, availableSessions, callback);
        }
    ], callback);
}

/**
 * Try to book in order for the give dates and time until sucess or tried all
 * 
 * <p>It is required to be loged in.
 * 
 * <p>Should be used in strategy 'dateAndTimeOrder'.
 * 
 * @param {array} dateAndTimeBookingPreference array of strings of the date and time to book, in order of preference.
 * If contains no time zone, it will be considered local.
 * 
 * Return the guid, as a string, if suceeded.
 */
function tryToBookInOrder(dateAndTimeBookingPreference, callback) {
    let bookedGuid;
    return async.eachSeries(dateAndTimeBookingPreference, (dateAndTime, callback) => {
        if (bookedGuid) {
            // Already booked
            return callback();
        }

        return checkAvailabilityAndTryToBook(dateAndTime, (err, guid) => {
            if (err) {
                // If not succeeded, try next
                log.log('info', 'Booking for ' + dateAndTime + ' failed: ' + err);
                return callback();
            }

            bookedGuid = guid;
            log.log('info', 'Booking for ' + dateAndTime + ' succeeded: ' + guid);
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
 * Try to book in order for the given date and in the given time order until sucess or tried all
 * 
 * <p>It is required to be loged in.
 * 
 * @param {string} dateString date string. If no time zone is provided, it is considered as local.
 * @param {array} timeBookingPreference array of strings with time of booking. If no time zone, it is considered as local.
 * e.g. ["20:00", "21:00", "18:00Z"].
 * 
 * Return the guid, as a string, if suceeded.
 */
function tryToBookInOrderSameDate(dateString, timeBookingPreference, callback) {
    let isoDateString = utils.dateAndTimeOrDateToDate(dateString);
    return async.waterfall([
        (callback) => {
            return connection.listAvailableBookings(isoDateString, callback);
        },
        (availableSessions, callback) => {
            let bookedGuid;
            return async.eachSeries(timeBookingPreference, (time, callback) => {
                if (bookedGuid) {
                    // Already booked
                    return callback();
                }

                let isoDateAndTime = utils.datePlusTimeToDateAndTime(isoDateString, time);
                log.log('info', 'Trying to book at ' + isoDateAndTime);
                return tryToBookGivenAvailability(isoDateAndTime, availableSessions, (err, guid) => {
                    if (err) {
                        // If not succeeded, try next
                        log.log('info', 'Booking for ' + isoDateAndTime + ' failed: ' + err);
                        return callback();
                    }

                    bookedGuid = guid;
                    log.log('info', 'Booking for ' + isoDateAndTime + ' succeeded: ' + guid);
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
    ], callback);
}

/**
 * Try to book in order for the next occurence of the weekday and in the given time order until sucess or tried all
 * 
 * <p>It is required to be loged in.
 * 
 * <p>Weekday is obtained with the offset minimum days in the future.
 * 
 * <p>Should be used in strategy 'weekdayAndTimeOrder'.
 * 
 * @param {number|string} weekday the day of the week (0 = Sunday, 6 = Monday), either a string or number.
 * @param {number} offset the number of days from now to be disconsidered. For instance, if today is Sunday, requesting
 * 'Wednesday' with offset 2 will return next Wednesday, with offset 5, the one in the next week.
 * @param {array} timeBookingPreference array of strings with time of booking. If no time zone, it is considered as local.
 * e.g. ["20:00", "21:00", "18:00Z"].
 * 
 * Return the guid, as a string, if suceeded.
 */
function tryToBookInOrderWeekday(weekday, offset, timeBookingPreference, callback) {
    let dateString = utils.getNextDateForWeekday(weekday, offset);
    log.log('info', 'Trying to book for weekday ' + weekday + ' which date is ' + dateString);
    return tryToBookInOrderSameDate(dateString, timeBookingPreference, callback);
}

/**
 * Keep trying to book until success
 * 
 * <p>It is required to be loged in.
 * 
 * @param {function} bookingLambda lambda function used to book. It should receive only a callback and return the guid.
 * @param {number} retryTimeout time in milliseconds between to retries.
 * 
 * Return the guid, as a string, if suceeded.
 */
function keepTryingToBook(bookingLambda, retryTimeout, callback) {
    log.log('info', 'Starting infinite loop to keep trying to book');
    let bookedGuid;
    async.whilst(() => {
        return !bookedGuid;
    }, (callback) => {
        setTimeout(() => {
            return bookingLambda((err, guid) => {
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

/**
 * Try to rebook a better spot and cancels the previous one
 * 
 * @param {function} bookingLambda the function used to rebook, already taking into consideration the reduced
 * list of preference.
 * @param {string} bookedGuid the already booked guid.
 * @param {string} reasonToCancel any reason why cancelling.
 * 
 * Return the guid, as a string, either the new one if succeeded of the previous one otherwise.
 */
function tryToRebookBetterOne(bookingLambda, bookedGuid, reasonToCancel, callback) {
    log.log('info', 'Trying to book a better spot');
    return bookingLambda((err, guid) => {
        if (err) {
            // Keep the previous booking
            log.log('info', 'Could not book a better spot, keeping the previous one');
            return callback(null, bookedGuid);
        }

        return connection.cancelBooking(bookedGuid, reasonToCancel, (err) => {
            if (err) {
                // Just keep both bookings and return the best one
                log.log('warn', 'Better spot booked but could not cancel previous one, please cancel manually');
                return callback(null, guid);
            }

            // Booking successfully cancelled.
            log.log('info', 'Better spot booked successfully: ' + guid);
            return callback(null, guid);
        });
    });
}

/**
 * Perform dateAndTimeOrder strategy
 * 
 * @param {Object} settings object in expected structure:
 * {
 *      credentials: {
 *          login: 'email@host.com',
 *          password: 'password'
 *      },
 *      hostname: 'the.site.co.uk',
 *      reasonToCancel: 'Any reason',
 *      dateAndTimeOrder: {
 *          bookingPreference: [
 *              '2017-10-11T20:00:00.0000000',
 *              '2017-10-11T19:00:00.0000000',
 *              '2017-10-11T21:00:00.0000000',
 *              '2017-10-11T18:00:00.0000000'
 *          ]
 *      },
 *      retryTimeout: 3
 * }
 */
function dateAndTimeOrder(settings) {
    log.log('info', 'Starting strategy dateAndTimeOrder');
    connection.setHostname(settings.hostname);
    return async.waterfall([
        connection.getInitialCookies,
        (callback) => {
            return connection.login(settings.credentials.login, settings.credentials.password, callback);
        },
        (callback) => {
            return keepTryingToBook((callback) => {
                return tryToBookInOrder(settings.dateAndTimeOrder.bookingPreference, callback);
            }, settings.retryTimeout, callback);
        },
        connection.queryBookInformation,
        (bookingInformation, callback) => {
            return tryToRebookBetterOne((callback) => {
                let newDateAndTimeOrder = utils.getMorePrioritizedDateAndTime(bookingInformation.StartDateTime,
                    settings.dateAndTimeOrder.bookingPreference);
                return tryToBookInOrder(newDateAndTimeOrder, callback);
            }, bookingInformation.Guid, settings.reasonToCancel, callback);
        },
        connection.queryBookInformation
    ], (err, result) => {
        if (err) {
            log.error('error', err);
        } else {
            log.log('info', 'Result: ' + JSON.stringify(result));
        }
    });
}

/**
 * Perform dateAndTimeOrder strategy
 * 
 * @param {Object} settings object in expected structure:
 * {
 *      credentials: {
 *          login: 'email@host.com',
 *          password: 'password'
 *      },
 *      hostname: 'the.site.co.uk',
 *      reasonToCancel: 'Any reason',
 *      weekdayAndTimeOrder: {
 *          weekday: 'Wednesday',
 *          offset: 3,
 *          timePreference: [
 *              '20:00',
 *              '19:00',
 *              '21:00',
 *              '18:00'
 *          ]
 *      },
 *      retryTimeout: 3
 * }
 */
function weekdayAndTimeOrder(settings) {
    log.log('info', 'Starting strategy weekdayAndTimeOrder');
    connection.setHostname(settings.hostname);
    return async.waterfall([
        connection.getInitialCookies,
        (callback) => {
            return connection.login(settings.credentials.login, settings.credentials.password, callback);
        },
        (callback) => {
            return keepTryingToBook((callback) => {
                return tryToBookInOrderWeekday(settings.weekdayAndTimeOrder.weekday,
                    settings.weekdayAndTimeOrder.offset,
                    settings.weekdayAndTimeOrder.timePreference,
                    callback);
            }, settings.retryTimeout, callback);
        },
        connection.queryBookInformation,
        (bookingInformation, callback) => {
            return tryToRebookBetterOne((callback) => {
                let newTimeOrder = utils.getMorePrioritizedTime(bookingInformation.StartDateTime,
                    settings.weekdayAndTimeOrder.timePreference);
                return tryToBookInOrderWeekday(settings.weekdayAndTimeOrder.weekday,
                    settings.weekdayAndTimeOrder.offset,
                    newTimeOrder,
                    callback);
            }, bookingInformation.Guid, settings.reasonToCancel, callback);
        },
        connection.queryBookInformation
    ], (err, result) => {
        if (err) {
            log.error('error', err);
        } else {
            log.log('info', 'Result: ' + JSON.stringify(result));
        }
    });
}

module.exports = {
    dateAndTimeOrder: dateAndTimeOrder,
    weekdayAndTimeOrder: weekdayAndTimeOrder
}