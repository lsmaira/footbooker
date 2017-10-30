'use-strict';

/**
 * Convert to date in ISO format
 * 
 * <p>Useful for quering availability for a given date and time.
 * 
 * @param {string} dateAndTime date and time string. If no time zone information is provided, it is considered local.
 * 
 * Return the converted string in ISO format. The date in UTC is considered.
 */
function dateAndTimeOrDateToDate(dateAndTime) {
    let date = new Date(dateAndTime);
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    return date.toISOString();
}

/**
 * Convert a non TZD date and time string to ISO format
 * 
 * <p>Date and time in the string are considered local.
 * 
 * <p>If a TZD date and time is received, the right time zone is considered.
 * 
 * @param {string} localDateAndTime date and time with no time zone indication (will be considered local).
 * 
 * Return the converted string in ISO format.
 */
function localOrISOToISO(localDateAndTime) {
    let date = new Date(localDateAndTime);
    return date.toISOString();
}

/**
 * Convert to local date and time human readable
 * 
 * <p>Can be used for displaying the final result.
 * 
 * @param {string} isoDateAndTime date and time in ISO format.
 * 
 * Return a string representing the given date and time in local time.
 */
function isoToLocal(isoDateAndTime) {
    let date = new Date(isoDateAndTime);
    return date.toLocaleString();
}

/**
 * Compose date with time to build date and time string
 * 
 * @param {string} dateString date string. Will be considered local unless time zone information is contained in the string.
 * If zone information is contained, the date considered is the one converted to local time.
 * @param {string} timeString time string. Will be considered local.
 * 
 * Return composed date and time string in ISO format. Examples (in UTC+1):
 * ("2017-10-25T23:00", "21:00") -> 2017-10-25T20:00:00.000Z
 * ("2017-10-25T23:00Z", "21:00") -> 2017-10-26T20:00:00.000Z
 * ("2017-10-25T23:00", "21:00Z") -> 2017-10-25T21:00:00.000Z
 * ("2017-10-25T23:00Z", "21:00Z") -> 2017-10-26T21:00:00.000Z
 */
function datePlusTimeToDateAndTime(dateString, timeString) {
    let date = new Date(dateString);
    let localDateAndTimeString = date.toDateString() + " " + timeString;
    return new Date(localDateAndTimeString).toISOString();
}

/**
 * Get the next requested weekday considering the given offset
 * 
 * @param {number|string} weekday the day of the week (0 = Sunday, 6 = Monday), either a string or number.
 * @param {number} offset number of days to disconsider since 'now'.
 * 
 * Return the date string, in ISO format, of the next weekday.
 */
function getNextDateForWeekday(weekday, offset) {
    var days = {sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6};
    
    var dayIndex;
    if (typeof weekday === 'string') {
        dayIndex = days[weekday.toLowerCase()];
        // 0 is considered as false
        if (dayIndex !== 0 && !dayIndex) {
            throw new Error('"' + weekday + '" is not a valid input.');
        }
    } else {
        dayIndex = weekday;
    }
    
    var returnDate = new Date();
    returnDate.setDate(returnDate.getDate() + offset);
    var returnDay = returnDate.getDay();
    if (dayIndex !== returnDay) {
        returnDate.setDate(returnDate.getDate() + (dayIndex + (7 - returnDay)) % 7);
    }
    
    returnDate = new Date(Date.UTC(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate()));
    return returnDate.toISOString();
}

/**
 * Returns the bookings that are more prioritized than the given one
 * 
 * <p>Comparator is used to compare the bookings.
 * 
 * @param {string} bookedDateAndTime string of the booked session. If no time zone is provided, it is considered local.
 * @param {array} bookingPreference array of strings of the booking preference date and time.
 * If no time zone is provided, it is considered local.
 * @param {function} comparator comparator receiving in first parameter booking in the list, and in second the
 * booked date and time.
 * 
 * Return a new array.
 */
function getMorePrioritized(bookedDateAndTime, bookingPreference, comparator) {
    let found = false;
    let morePrioritized = [];
    bookingPreference.forEach((book) => {
        if (!found) {
            if (comparator(book, bookedDateAndTime)) {
                found = true;
            } else {
                morePrioritized.push(book);
            }
        }
    });
    return morePrioritized;
}

/**
 * Returns the bookings that are more prioritized than the given one
 * 
 * <p>A subarray with the bookings that come before the booked one is created.
 * This is used for retrying only the more prioritized bookings once one was
 * already successful, in case the others failed because it was not midnight yet.
 * </p>
 * 
 * @param {string} bookedDateAndTime string of the booked session. If no time zone is provided, it is considered local.
 * @param {array} bookingPreferenceDateAndTime array of strings of the booking preference date and time.
 * If no time zone is provided, it is considered local.
 * 
 * Return a new array.
 */
function getMorePrioritizedDateAndTime(bookedDateAndTime, bookingPreferenceDateAndTime) {
    return getMorePrioritized(bookedDateAndTime, bookingPreferenceDateAndTime, (book, bookedDateAndTime) => {
        return new Date(book).toISOString() === new Date(bookedDateAndTime).toISOString();
    });
}

/**
 * Returns the bookings that are more prioritized than the given one
 * 
 * <p>A subarray with the bookings that come before the booked one is created.
 * This is used for retrying only the more prioritized bookings once one was
 * already successful, in case the others failed because it was not midnight yet.
 * </p>
 * 
 * @param {string} bookedDateAndTime string of the booked session. If no time zone is provided, it is considered local.
 * @param {array} bookingPreferenceTime array of strings of the booking preference time.
 * If no time zone is provided, it is considered local.
 * 
 * Return a new array.
 */
function getMorePrioritizedTime(bookedDateAndTime, bookingPreferenceTime) {
    return getMorePrioritized(bookedDateAndTime, bookingPreferenceTime, (book, bookedDateAndTime) => {
        let bookDateAndTime = datePlusTimeToDateAndTime(bookedDateAndTime, book);
        return new Date(bookDateAndTime).toISOString() === new Date(bookedDateAndTime).toISOString();
    });
}

module.exports = {
    dateAndTimeOrDateToDate: dateAndTimeOrDateToDate,
    localOrISOToISO: localOrISOToISO,
    isoToLocal: isoToLocal,
    datePlusTimeToDateAndTime: datePlusTimeToDateAndTime,
    getNextDateForWeekday: getNextDateForWeekday,
    getMorePrioritizedDateAndTime: getMorePrioritizedDateAndTime,
    getMorePrioritizedTime: getMorePrioritizedTime
}