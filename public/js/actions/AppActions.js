var AppDispatcher = require('../dispatcher/AppDispatcher');
var AppConstants = require('../constants/AppConstants');
var AppSession = require('../session/AppSession');
var json_rpc = require('caf_transport').json_rpc;
var caf_cli =  require('caf_cli');

var updateF = function(state) {
    var d = {
        actionType: AppConstants.APP_UPDATE,
        state: state
    };
    AppDispatcher.dispatch(d);
};


var errorF =  function(err) {
    var d = {
        actionType: AppConstants.APP_ERROR,
        error: err
    };
    AppDispatcher.dispatch(d);
};

var getNotifData = function(msg) {
    return json_rpc.getMethodArgs(msg)[0];
};

var notifyF = function(message) {
    var d = {
        actionType: AppConstants.APP_NOTIFICATION,
        state: getNotifData(message)
    };
    AppDispatcher.dispatch(d);
};

var wsStatusF =  function(isClosed) {
    var d = {
        actionType: AppConstants.WS_STATUS,
        isClosed: isClosed
    };
    AppDispatcher.dispatch(d);
};

var AppActions = {
    initServer: function(initialData) {
        updateF(initialData);
    },
    async init() {
        try {
            var token = caf_cli.extractTokenFromURL(window.location.href);
            var data = await AppSession.hello(AppSession.getCacheKey(), token)
                    .getPromise();
            updateF(data);
            return [null, data];
        } catch (err) {
            errorF(err);
            return [err];
        }
    },
    setLocalState: function(data) {
        updateF(data);
    },
    resetError: function() {
        errorF(null);
    },
    setError: function(err) {
        errorF(err);
    }
};

['changePinMode', 'changePinValue', 'changeMaxSleep', 'blink', 'deletePin',
 'getState', 'resetBlinks']
    .forEach(function(x) {
        AppActions[x] = async function() {
            var args = Array.prototype.slice.call(arguments);
            try {
                var data = await AppSession[x].apply(AppSession, args)
                        .getPromise();
                updateF(data);
            } catch (err) {
                errorF(err);
            }
        };
    });

AppSession.onmessage = function(msg) {
    console.log('message:' + JSON.stringify(msg));
    AppActions.getState();
    //notifyF(msg);
};

AppSession.onclose = function(err) {
    console.log('Closing:' + JSON.stringify(err));
    wsStatusF(true);
};


module.exports = AppActions;
