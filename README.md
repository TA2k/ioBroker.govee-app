![Logo](admin/govee-app.png)

# ioBroker.govee-app

[![NPM version](https://img.shields.io/npm/v/iobroker.govee-app.svg)](https://www.npmjs.com/package/iobroker.govee-app)
[![Downloads](https://img.shields.io/npm/dm/iobroker.govee-app.svg)](https://www.npmjs.com/package/iobroker.govee-app)
![Number of Installations](https://iobroker.live/badges/govee-app-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/govee-app-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.govee-app.png?downloads=true)](https://nodei.co/npm/iobroker.govee-app/)

**Tests:** ![Test and Release](https://github.com/TA2k/ioBroker.govee-app/workflows/Test%20and%20Release/badge.svg)
**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## govee adapter for ioBroker

Adapter for Govee via App

Man kann snapshots und defaults auswählen und aktivieren.

Aktueller status:
govee-app.0.id.status

## Steuerung

govee-app.0.id.remote
Bisher gehen turn, brightness und color.

govee-app.0.id.snapshots
Außerdem kann man snapshots aktivieren

govee-app.0.defaults
Außerdem kann man defaults/kurzbefehle aktivieren

# English

Adapter for Govee via App

You can select and enable snapshots and defaults.

Current status:

govee-app.0.id.status

## Control

govee-app.0.id.remote

So far turn, brightness and color are working.

govee-app.0.id.snapshots

You can also enable snapshots

govee-app.0.defaults

You can also enable defaults/shortcuts

## Changelog

### 0.0.4

- (TA2k) add support for BLE devices

### 0.0.3

- (TA2k) initial release

## License

MIT License

Copyright (c) 2023 TA2k <tombox2020@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
