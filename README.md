# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com

## CAF IoT example of power management with impersonation.

Basic example combining a CA, an IoT device application, and a React+Flux
front end.

Using a Witty Pi addon to a RPi we can switch off the power, and ensure that the RPi will restart after certain time. During that time the CA impersonates the device so nobody notices that the device is off-line.
