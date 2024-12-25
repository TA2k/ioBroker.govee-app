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

ptReal Commands:

On: 3301010000000000000000000000000000000033

Off: 3301000000000000000000000000000000000032

3314010000000000000000000000000000000026 = Gradient On
3314000000000000000000000000000000000027 = Gradient Off

https://github.com/BeauJBurroughs/Govee-H6127-Reverse-Engineering

multiSync:
Level 1: 3a0501010000000000000000000000000000003f
Level 2: 3a0501020000000000000000000000000000003c
Level 3: 3a0501030000000000000000000000000000003d
Level 4: 3a0501040000000000000000000000000000003a
Level 5: 3a0501050000000000000000000000000000003b
Level 6: 3a05010600000000000000000000000000000038
Level 7: 3a05010700000000000000000000000000000039
Level 8: 3a05010800000000000000000000000000000036

Custom 5 2h: 3a05021108003c003c050078007801ffffffff20

Nightlight On : 3a1b010101000000000000000000000000000020
Nightlight Off: 3a1b010100000000000000000000000000000021

## Changelog

### 0.0.7 (2024-12-20)

- fix for rgb control
- mqtt reconnect after error

### 0.0.6

- (TA2k) add support for BLE devices

### 0.0.3

- (TA2k) initial release

## License

MIT License

Copyright (c) 2023-2030 TA2k <tombox2020@gmail.com>

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
