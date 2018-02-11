var React = require('react');
var ReactDOM = require('react-dom');
var ReactServer = require('react-dom/server');
var AppSession = require('./session/AppSession');
var MyApp = require('./components/MyApp');
var AppActions = require('./actions/AppActions');

var cE = React.createElement;

AppSession.onopen = async function() {
    console.log('open session');
    var result = await AppActions.init();
    var err = result[0];
    if (err) {
        console.log('Cannot connect:' + err);
    } else {
        ReactDOM.render(
            cE(MyApp, null),
            document.getElementById('content')
        );
    }
};


var main = exports.main = function(data) {
    if (typeof window === 'undefined') {
        // server side rendering
        AppActions.initServer(data);
        return ReactServer.renderToString(cE(MyApp, null));
    } else {
        console.log('Hello');
        return null;
    }
};
