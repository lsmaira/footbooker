const assert = require('assert');

describe('Example test group', function() {

    describe('Example test subgroup', function() {

        it('example async test', function(done) {
            let err = null;
            if (err) {
                done(err);
            } else {
                done();
            }
        });

        it('example sync test', function() {
            assert.equal(-1, [1,2,3].indexOf(4));
        });

    });

});