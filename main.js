"use strict";

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios").default;
const Json2iob = require("json2iob");
const forge = require("node-forge");
const awsIot = require("aws-iot-device-sdk");
const path = require("path");
class GoveeApp extends utils.Adapter {
  /**
   * @param {Partial<utils.AdapterOptions>} [options={}]
   */
  constructor(options) {
    super({
      ...options,
      name: "govee-app",
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
    this.deviceArray = [];
    this.devices = {};

    this.updateInterval = null;
    this.session = {};
    this.defaultObjects = {};
    this.groups = {};
    this.iot = {};
    this.snapshots = {};
    this.diys = {};
    this.json2iob = new Json2iob(this);
    this.requestClient = axios.create();
    this.reconnectTimeout = null;
    this.randomClientId = Math.random().toString(16).slice(2, 19);
    this.clientId = "d39f7b0732a24e58acf771103ebefc04";
  }

  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    // Reset the connection indicator during startup
    this.setState("info.connection", false, true);
    // if (this.config.interval < 0.5) {
    //   this.log.info("Set interval to minimum 0.5");
    //   this.config.interval = 0.5;
    // }
    if (!this.config.username || !this.config.password) {
      this.log.error("Please set username and password in the instance settings");
      return;
    }

    this.subscribeStates("*");

    this.log.info("Login to Govee App");
    await this.login();
    if (this.session.token) {
      await this.getDeviceList();
      this.log.info("Connect to MQTT");
      await this.connectMqtt();
      await this.updateDevices();
      this.updateInterval = this.setInterval(
        async () => {
          await this.updateDevices();
          await this.updateViaDeviceList();
        },
        5 * 60 * 1000,
      );
    }
    this.refreshTokenInterval = this.setInterval(
      () => {
        this.refreshToken();
      },
      24 * 60 * 60 * 1000,
    );
  }
  async login() {
    const data = {
      client: this.clientId,
      email: this.config.username,
      password: this.config.password,
    };
    if (this.config.code) {
      data.code = this.config.code;
    }
    await this.requestClient({
      method: "post",
      url: "https://app2.govee.com/account/rest/account/v2/login",
      headers: {
        "content-type": "application/json",
        accept: "*/*",
        timestamp: Date.now() + ".081500",
        envid: "0",
        clientid: this.clientId,
        appversion: "6.4.12",
        "accept-language": "de",
        clienttype: "1",
        "user-agent": "GoveeHome/6.4.12 (com.ihoment.GoVeeSensor; build:3; iOS 15.8.3) Alamofire/5.6.4",
        timezone: "Europe/Berlin",
        country: "DE",
        iotversion: "0",
      },
      data: data,
    })
      .then((res) => {
        this.log.debug(JSON.stringify(res.data));
        if (res.data.client) {
          this.log.info("Login successful");
          this.session = res.data.client;
          this.setState("info.connection", true, true);
        } else if (res.data.status === 454) {
          //2FA
          this.log.warn("2FA required. Please enter the code in the instance settings");
          this.requestClient({
            method: "post",
            maxBodyLength: Infinity,
            url: "https://app2.govee.com/account/rest/account/v1/verification",
            headers: {
              "content-type": "application/json",
              accept: "*/*",
              timestamp: Date.now() + ".081500",
              envid: "0",
              clientid: this.clientId,
              appversion: "6.4.12",
              "accept-language": "de",
              sysversion: "15.8.3",
              clienttype: "1",
              "user-agent": "GoveeHome/6.4.12 (com.ihoment.GoVeeSensor; build:3; iOS 15.8.3) Alamofire/5.6.4",
              timezone: "Europe/Berlin",
              country: "DE",
              iotversion: "0",
            },
            data: {
              type: 8,
              email: this.config.username,
            },
          })
            .then((res) => {
              this.log.debug(JSON.stringify(res.data));
            })
            .catch((error) => {
              this.log.error(error);
              this.log.error("2FA failed");
              error.response && this.log.error(JSON.stringify(error.response.data));
            });
          return;
        } else {
          this.log.error("Login failed: " + JSON.stringify(res.data));
          return;
        }
      })
      .catch((error) => {
        this.log.error(error);
        this.log.error("Login failed");
        error.response && this.log.error(JSON.stringify(error.response.data));
      });

    await this.requestClient({
      method: "get",
      url: "https://app2.govee.com/app/v1/account/iot/key",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + this.session.token,
        accept: "*/*",
        timestamp: Date.now() + ".686035",
        envid: "0",
        clientid: this.clientId,
        appversion: "6.4.12",
        "accept-language": "de",
        clienttype: "1",
        "user-agent": "GoveeHome/5.4.10 (com.ihoment.GoVeeSensor; build:3; iOS 14.8.0) Alamofire/5.6.4",
        timezone: "Europe/Berlin",
        country: "DE",
        iotversion: "0",
      },
    })
      .then((res) => {
        this.log.debug(JSON.stringify(res.data));
        if (res.data.data) {
          this.log.info("Received IoT key");
          this.iot = res.data.data;
          this.iot.pem = this.convertToPem(this.iot.p12, this.iot.p12Pass);
        } else {
          this.log.error("iot key failed: " + JSON.stringify(res.data));
          return;
        }
      })
      .catch((error) => {
        this.log.error(error);
        this.log.error("Login failed");
        error.response && this.log.error(JSON.stringify(error.response.data));
      });
  }

  async updateViaDeviceList() {
    await this.requestClient({
      method: "post",
      url: "https://app2.govee.com/device/rest/devices/v1/list",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + this.session.token,
        accept: "*/*",
        timestamp: Date.now() + ".767822",
        envid: "0",
        clientid: this.clientId,
        appversion: "6.4.12",
        "accept-language": "de",
        clienttype: "1",
        "user-agent": "GoveeHome/5.4.10 (com.ihoment.GoVeeSensor; build:3; iOS 14.8.0) Alamofire/5.6.4",
        timezone: "Europe/Berlin",
        country: "DE",
        iotversion: "0",
      },
    })
      .then(async (res) => {
        this.log.debug(JSON.stringify(res.data));
        for (const device of res.data.devices) {
          const id = device.device;
          if (!id) {
            continue;
          }
          device.deviceExt.deviceSettings = JSON.parse(device.deviceExt.deviceSettings);
          device.deviceExt.extResources = JSON.parse(device.deviceExt.extResources);
          device.deviceExt.lastDeviceData = JSON.parse(device.deviceExt.lastDeviceData);
          await this.json2iob.parse(id, device, { forceIndex: true });
        }
      })
      .catch((error) => {
        this.log.error(error);
        error.response && this.log.error(JSON.stringify(error.response.data));
      });
  }
  async getDeviceList() {
    //GET https://app2.govee.com/bff-app/v1/data-square/devices
    await this.requestClient({
      method: "post",
      url: "https://app2.govee.com/device/rest/devices/v1/list",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + this.session.token,
        accept: "*/*",
        timestamp: Date.now() + ".767822",
        envid: "0",
        clientid: this.clientId,
        appversion: "6.4.12",
        "accept-language": "de",
        clienttype: "1",
        "user-agent": "GoveeHome/6.4.12 (com.ihoment.GoVeeSensor; build:3; iOS 15.8.3) Alamofire/5.6.4",
        timezone: "Europe/Berlin",
        country: "DE",
        iotversion: "0",
      },
    })
      .then(async (res) => {
        this.log.debug(JSON.stringify(res.data));

        if (res.data.devices) {
          this.log.info(`Found ${res.data.devices.length} devices`);
          for (const device of res.data.devices) {
            const id = device.device;
            if (!id) {
              this.log.warn(`Device without id found: ${JSON.stringify(device)}`);
              continue;
            }
            this.devices[id] = device;
            this.deviceArray.push(device);
            const name = device.deviceName;
            device.deviceExt.deviceSettings = JSON.parse(device.deviceExt.deviceSettings);
            device.deviceExt.extResources = JSON.parse(device.deviceExt.extResources);
            device.deviceExt.lastDeviceData = JSON.parse(device.deviceExt.lastDeviceData);

            await this.extendObject(id, {
              type: "device",
              common: {
                name: name,
              },
              native: {},
            });
            await this.extendObject(id + ".remote", {
              type: "channel",
              common: {
                name: "Remote Controls",
              },
              native: {},
            });
            await this.extendObject(id + ".status", {
              type: "channel",
              common: {
                name: "Status",
              },
              native: {},
            });

            const remoteArray = [
              { command: "Refresh", name: "True = Refresh" },
              { command: "turn", type: "number", role: "switch", name: "0 = Off, 1 = On", def: 0 },
              { command: "brightness", type: "number", role: "level.brightness", name: "Brightness", def: 0 },
              { command: "r", type: "number", role: "level", name: "Color red", def: 0 },
              { command: "g", type: "number", role: "level", name: "Color green", def: 0 },
              { command: "b", type: "number", role: "level", name: "Color blue", def: 0 },
              { command: "colorwc", type: "number", role: "level", name: "Color Temp", def: 0 },
              {
                command: "ptReal",
                type: "string",
                role: "text",
                name: "Send Custom OnOff 3301000000000000000000000000000000000032",
                def: "3301010000000000000000000000000000000033",
              },
              {
                command: "multiSync",
                type: "string",
                role: "text",
                name: "Send Custom Level see Readme",
                def: "3a0501020000000000000000000000000000003c",
              },
            ];
            remoteArray.forEach((remote) => {
              this.extendObject(id + ".remote." + remote.command, {
                type: "state",
                common: {
                  name: remote.name || "",
                  type: remote.type || "boolean",
                  role: remote.role || "button",
                  def: remote.def != null ? remote.def : false,
                  write: true,
                  read: true,
                },
                native: {},
              });
            });
            await this.json2iob.parse(id, device, { forceIndex: true, channelName: name });
            //receive snapshots
            await this.requestClient({
              method: "get",
              url:
                "https://app2.govee.com/bff-app/v1/devices/snapshots?sku=" +
                device.sku +
                "&device=" +
                device.device +
                "&snapshotId=-1",
              headers: {
                "content-type": "application/json",
                authorization: "Bearer " + this.session.token,
                accept: "*/*",
                timestamp: Date.now() + ".686035",
                envid: "0",
                clientid: this.clientId,
                appversion: "6.4.12",
                "accept-language": "de",
                clienttype: "1",
                "user-agent": "GoveeHome/5.4.10 (com.ihoment.GoVeeSensor; build:3; iOS 14.8.0) Alamofire/5.6.4",
                timezone: "Europe/Berlin",
                country: "DE",
                iotversion: "0",
              },
            })
              .then(async (res) => {
                this.log.debug(JSON.stringify(res.data));
                if (res.data.data) {
                  await this.extendObject(id + ".snapshots", {
                    type: "channel",
                    common: {
                      name: "Activate Snapshots",
                    },
                    native: {},
                  });
                  for (const snapshot of res.data.data.snapshots) {
                    this.log.info("Received Snapshot: " + snapshot.name + " " + snapshot.snapshotId);
                    this.snapshots[snapshot.snapshotId] = snapshot;
                    this.extendObject(id + ".snapshots." + snapshot.snapshotId, {
                      type: "state",
                      common: {
                        name: snapshot.name || "",
                        type: "boolean",
                        role: "boolean",
                        def: false,
                        write: true,
                        read: true,
                      },
                      native: {},
                    });
                  }
                }
              })
              .catch((error) => {
                this.log.error(error);
                this.log.error("snapshots failed");
                error.response && this.log.error(JSON.stringify(error.response.data));
              });
            //receive diys
            // await this.requestClient({
            //   method: "get",
            //   url:
            //     "https://app2.govee.com/appsku/v2/diys/quick_operation?sku=" +
            //     device.sku +
            //     "&goodsType=" +
            //     device.goodsType,
            //   headers: {
            //     "content-type": "application/json",
            //     authorization: "Bearer " + this.session.token,
            //     accept: "*/*",
            //     timestamp: Date.now() + ".686035",
            //     envid: "0",
            //     clientid:this.clientId,
            //     appversion: "5.4.10",
            //     "accept-language": "de",
            //     clienttype: "1",
            //     "user-agent": "GoveeHome/5.4.10 (com.ihoment.GoVeeSensor; build:3; iOS 14.8.0) Alamofire/5.6.4",
            //     timezone: "Europe/Berlin",
            //     country: "DE",
            //     iotversion: "0",
            //   },
            // })
            //   .then(async (res) => {
            //     this.log.debug(JSON.stringify(res.data));
            //     if (res.data.data && res.data.data.diys[0] && res.data.data.diys[0].diys) {
            //       await this.setObjectNotExistsAsync(id + ".diys", {
            //         type: "channel",
            //         common: {
            //           name: "Activate Diys",
            //         },
            //         native: {},
            //       });
            //       for (const diy of res.data.data.diys[0].diys) {
            //         this.log.info("Received diys: " + diy.diyName + " " + diy.diyId);
            //         this.diys[diy.diyId] = diy;
            //         this.setObjectNotExists(id + ".diys." + diy.diyId, {
            //           type: "state",
            //           common: {
            //             name: diy.diyName || diy.shareInfo.shareDes,
            //             type: "boolean",
            //             role: "boolean",
            //             def: false,
            //             write: true,
            //             read: true,
            //           },
            //           native: {},
            //         });
            //       }
            //     }
            //   })
            //   .catch((error) => {
            //     this.log.error(error);
            //     this.log.error("diy failed");
            //     error.response && this.log.error(JSON.stringify(error.response.data));
            //   });
          }

          // receive defaults
          await this.requestClient({
            method: "get",
            url: "https://app2.govee.com/bff-app/v1/exec-plat/home",
            headers: {
              authorization: "Bearer " + this.session.token,
              accept: "*/*",
              timestamp: Date.now() + ".686035",
              envid: "0",
              clientid: this.clientId,
              appversion: "6.4.12",
              "accept-language": "de",
              clienttype: "1",
              "user-agent": "GoveeHome/5.4.10 (com.ihoment.GoVeeSensor; build:3; iOS 14.8.0) Alamofire/5.6.4",
              timezone: "Europe/Berlin",
              country: "DE",
              iotversion: "0",
            },
          })
            .then(async (res) => {
              this.log.debug(JSON.stringify(res.data));

              if (res.data.data && res.data.data.components) {
                const defaults = res.data.data.components.filter((obj) => {
                  return obj.type === 1;
                });
                if (defaults[0]) {
                  await this.setObjectNotExistsAsync("defaults", {
                    type: "channel",
                    common: {
                      name: "Activate Defaults",
                    },
                    native: {},
                  });
                  for (const defaultItem of defaults[0].oneClicks) {
                    this.log.info("Received default: " + defaultItem.name);
                    this.defaultObjects[defaultItem.siriEngineId] = defaultItem;
                    this.setObjectNotExists("defaults." + defaultItem.siriEngineId, {
                      type: "state",
                      common: {
                        name: defaultItem.name,
                        type: "boolean",
                        role: "boolean",
                        def: false,
                        write: true,
                        read: true,
                      },
                      native: {},
                    });
                  }
                }
              }
            })
            .catch((error) => {
              this.log.error(error);
              this.log.error("defaults failed");
              error.response && this.log.error(JSON.stringify(error.response.data));
            });

          // receive groups
          await this.requestClient({
            method: "get",
            url: "https://app2.govee.com/bff-app/v1/widget/groups-devices",
            headers: {
              authorization: "Bearer " + this.session.token,
              accept: "*/*",
              timestamp: Date.now() + ".686035",
              envid: "0",
              clientid: this.clientId,
              appversion: "6.4.12",
              "accept-language": "de",
              clienttype: "1",
              "user-agent": "GoveeHome/5.4.10 (com.ihoment.GoVeeSensor; build:3; iOS 14.8.0) Alamofire/5.6.4",
              timezone: "Europe/Berlin",
              country: "DE",
              iotversion: "0",
            },
          })
            .then(async (res) => {
              this.log.debug(JSON.stringify(res.data));

              if (res.data.data && res.data.data.groups) {
                await this.setObjectNotExistsAsync("groups", {
                  type: "channel",
                  common: {
                    name: "Activate Groups",
                  },
                  native: {},
                });
                for (const group of res.data.data.groups) {
                  this.log.info("Received groups: " + group.name);
                  this.groups[group.gId] = group;
                  this.setObjectNotExists("groups." + group.gId, {
                    type: "state",
                    common: {
                      name: group.name,
                      type: "boolean",
                      role: "boolean",
                      def: false,
                      write: true,
                      read: true,
                    },
                    native: {},
                  });
                }
              }
            })
            .catch((error) => {
              this.log.error(error);
              this.log.error("groups failed");
              error.response && this.log.error(JSON.stringify(error.response.data));
            });
        }
      })
      .catch((error) => {
        this.log.error(error);
        error.response && this.log.error(JSON.stringify(error.response.data));
      });
  }
  async connectMqtt() {
    try {
      let region = "us-east-1";

      const split_mqtt = this.iot.endpoint.split(".");
      if (split_mqtt.length === 3) {
        region = split_mqtt[2];
      }
      if (this.mqttC) {
        this.mqttC.end();
        await this.delay(2000);
      }

      this.mqttC = awsIot.device({
        clientId: `AP/${this.session.accountId}/` + this.randomClientId,
        username: "?SDK=Android&Version=2.15.2",
        privateKey: Buffer.from(this.iot.pem.pemKey, "utf-8"),
        clientCert: Buffer.from(this.iot.pem.pemCertificate, "utf-8"),
        caPath: path.join(__dirname, "lib", "amazon.pem"),
        host: this.iot.endpoint,
        region: region,
      });

      this.mqttC.on("offline", () => {
        this.log.debug("MQTT offline");
      });

      this.mqttC.on("disconnect", (packet) => {
        this.log.debug("MQTT disconnect" + packet);
      });

      this.mqttC.on("connect", () => {
        this.log.debug("MQTT connected");
        this.log.debug(" MQTT subscribe to " + this.session.topic);
        this.mqttC.subscribe(this.session.topic, { qos: 1 });
      });

      this.mqttC.on("reconnect", () => {
        this.log.debug("MQTT reconnect");
      });

      this.mqttC.on("message", async (topic, message) => {
        try {
          const data = JSON.parse(message);
          this.log.debug("MQTT message: " + topic + " " + JSON.stringify(data));
          let status = data.state;
          let device = data.device;
          if (data.msg) {
            const msg = JSON.parse(data.msg);
            device = msg.device;
            if (msg.data) {
              status = JSON.parse(msg.data);
            } else {
              return;
            }
          }
          if (device && status) {
            this.json2iob.parse(device + ".status", status, { forceIndex: true });
          } else {
            this.log.warn("Cannot parse MQTT message: " + topic + " " + JSON.stringify(data));
          }
        } catch (error) {
          this.log.warn(`Cannot parse MQTT message: ${topic} ${message} ${error}`);
        }
      });

      this.mqttC.on("error", (error) => {
        this.log.error("MQTT ERROR: " + error);
        if (this.mqttC) {
          this.reconnectTimeout && clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = setTimeout(() => {
            this.connectMqtt();
          }, 10000);
          this.log.info("Reconnect in 10 seconds");
        }
      });
    } catch (error) {
      this.log.error("MQTT ERROR: " + error);
      this.mqttC = undefined;
    }
  }
  async updateDevices() {
    for (const device of this.deviceArray) {
      this.log.debug(" MQTT publish to " + device.device);
      this.log.debug(
        `Publish to ${device.deviceExt.deviceSettings.topic} data: {"msg":{"accountTopic":"${this.session.topic}","cmd":"status","cmdVersion":0,"transaction":"x_${Date.now()}","type":0}}`,
      );
      if (this.mqttC) {
        const publishResponse = await this.mqttC.publish(
          device.deviceExt.deviceSettings.topic,
          `{"msg":{"accountTopic":"${this.session.topic}","cmd":"status","cmdVersion":0,"transaction":"x_${Date.now()}","type":0}}`,
          { qos: 1 },
        );
        this.log.debug("Publish response: " + JSON.stringify(publishResponse));
      }
    }
  }

  async refreshToken() {
    this.log.debug("Refresh token");
    await this.login();
  }
  convertToPem(p12base64, password) {
    const p12Der = forge.util.decode64(p12base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
    const pemKey = this.getKeyFromP12(p12, password);
    const { pemCertificate, commonName } = this.getCertificateFromP12(p12);
    return { pemKey, pemCertificate, commonName };
  }

  getKeyFromP12(p12, password) {
    const keyData = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag }, password);
    let pkcs8Key = keyData[forge.pki.oids.pkcs8ShroudedKeyBag][0];

    if (typeof pkcs8Key === "undefined") {
      pkcs8Key = keyData[forge.pki.oids.keyBag][0];
    }

    if (typeof pkcs8Key === "undefined") {
      throw new Error("Unable to get private key.");
    }

    const pemKey = forge.pki.privateKeyToPem(pkcs8Key.key);
    // pemKey = pemKey.replace(/\r\n/g, "");

    return pemKey;
  }

  getCertificateFromP12(p12) {
    const certData = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certificate = certData[forge.pki.oids.certBag][0];

    const pemCertificate = forge.pki.certificateToPem(certificate.cert);
    // pemCertificate = pemCertificate.replace(/\r\n/g, "");
    const commonName = certificate.cert.subject.attributes[0].value;
    return { pemCertificate, commonName };
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   * @param {() => void} callback
   */
  async onUnload(callback) {
    try {
      this.setState("info.connection", false, true);
      this.updateInterval && this.clearInterval(this.updateInterval);
      this.refreshTokenInterval && this.clearInterval(this.refreshTokenInterval);
      this.reconnectTimeout && clearTimeout(this.reconnectTimeout);
      this.mqttC && this.mqttC.end();
      //get adapter settings and set captcha to null
      if (this.config.code) {
        const adapterSettings = await this.getForeignObjectAsync("system.adapter." + this.namespace);
        adapterSettings.native.code = null;
        await this.setForeignObject("system.adapter." + this.namespace, adapterSettings);
      }
      callback();
    } catch (e) {
      this.log.error("Error on unload: " + e);
      callback();
    }
  }

  /**
   * Is called if a subscribed state changes
   * @param {string} id
   * @param {ioBroker.State | null | undefined} state
   */
  async onStateChange(id, state) {
    if (state) {
      if (!state.ack) {
        // this.connectMqtt();
        // await this.sleep(1000);
        const deviceId = id.split(".")[2];
        const folder = id.split(".")[3];
        const command = id.split(".")[4];

        if (id.split(".")[4] === "Refresh") {
          this.updateDevices();
          return;
        }

        let mqttCommand = command;
        let data = `{"val":${state.val}}`;

        if (deviceId === "defaults") {
          const defaultItem = this.defaultObjects[folder];

          if (defaultItem) {
            if (!defaultItem.iotRules) {
              this.log.warn("Default not found: " + folder);
              this.log.info(JSON.stringify(defaultItem));
              return;
            }
            for (const iotRule of defaultItem.iotRules) {
              const iotMsg = [];
              for (const iotRuleItem of iotRule.rule) {
                iotMsg.push(iotRuleItem.iotMsg);
              }
              await this.requestClient({
                method: "post",
                url: "https://app2.govee.com/app/v2/circadian-rhythms/commands",
                headers: {
                  "content-type": "application/json",
                  authorization: "Bearer " + this.session.token,
                  accept: "*/*",
                  timestamp: Date.now() + ".686035",
                  envid: "0",
                  clientid: this.clientId,
                  appversion: "6.4.12",
                  "accept-language": "de",
                  clienttype: "1",
                  "user-agent": "GoveeHome/5.4.10 (com.ihoment.GoVeeSensor; build:3; iOS 14.8.0) Alamofire/5.6.4",
                  timezone: "Europe/Berlin",
                  country: "DE",
                  iotversion: "0",
                },
                data: {
                  iotSendMsgs: [
                    {
                      iotMsg: iotMsg,
                      topic: iotRule.deviceObj.topic,
                    },
                  ],
                  key: "",
                  transaction: Date.now(),
                  view: 0,
                },
              })
                .then((res) => {
                  this.log.info(JSON.stringify(res.data));
                })
                .catch((error) => {
                  this.log.error(error);
                  this.log.error("Command send failed");
                  error.response && this.log.error(JSON.stringify(error.response.data));
                });
            }
          }
          return;
        }
        if (deviceId === "groups") {
          const group = this.groups[folder];
          if (!group) {
            this.log.warn("Group not found: " + folder);
            return;
          }
          const value = state.val ? 1 : 0;
          mqttCommand = "turn";
          data = `{"val":${value}}`;
          for (const device of group.devices) {
            this.log.debug(" MQTT send: " + value + " to " + device.topic + " data " + data);
            this.mqttC.publish(
              device.topic,
              `{"msg":{"accountTopic":"${
                this.session.topic
              }","cmd":"${mqttCommand}","cmdVersion":0,"data":${data},"transaction":"x_${Date.now()}","type":1}}`,
              { qos: 1 },
            );
          }
          return;
        }
        const device = this.devices[deviceId];
        if (!device) {
          this.log.warn(`Device ${deviceId} not found`);
          return;
        }
        if (command === "ptReal" || command === "multiSync") {
          //send state.val hex values as base64
          data = `{"command":["${Buffer.from(state.val, "hex").toString("base64")}"]}`;
        }
        if (folder === "snapshots") {
          if (!this.snapshots[command]) {
            this.log.warn("Snapshot not found: " + command);
            return;
          }
          for (const cmd of this.snapshots[command].cmds) {
            this.mqttC.publish(device.deviceExt.deviceSettings.topic, cmd.iotCmd, { qos: 1 });
          }
          return;
        }

        if (folder === "diys") {
          for (const cmd of this.diys[command].cmds) {
            this.mqttC.publish(device.deviceExt.deviceSettings.topic, cmd.iotCmd, { qos: 1 });
          }
          return;
        }

        if (command === "r" || command === "g" || command === "b") {
          const r = await this.getStateAsync(deviceId + ".remote.r");
          const g = await this.getStateAsync(deviceId + ".remote.g");
          const b = await this.getStateAsync(deviceId + ".remote.b");
          mqttCommand = "color";
          if (r && g && b) {
            data = `{"val":{"red":${r.val},"green":${g.val},"blue":${b.val}}}`;
          }
        }

        if (command === "colorwc") {
          mqttCommand = "colorwc";
          data = `{"color":{"b":255,"g":255,"r":255},"colorTemInKelvin":${state.val}}`;
        }

        if (!device) {
          this.log.warn("Device not found: " + deviceId);
          return;
        }
        this.log.debug(" MQTT send: " + mqttCommand + " to " + device.device + " data " + data);
        this.mqttC.publish(
          device.deviceExt.deviceSettings.topic,
          `{"msg":{"accountTopic":"${
            this.session.topic
          }","cmd":"${mqttCommand}","cmdVersion":0,"data":${data},"transaction":"x_${Date.now()}","type":1}}`,
          { qos: 1 },
        );
        if (mqttCommand === "color") {
          mqttCommand = "colorwc";
          const r = await this.getStateAsync(deviceId + ".remote.r");
          const g = await this.getStateAsync(deviceId + ".remote.g");
          const b = await this.getStateAsync(deviceId + ".remote.b");

          if (r && g && b) {
            data = `{"color":{"b":${b.val},"g":${g.val},"r":${r.val}},"colorTemInKelvin":0}`;
          }
          this.log.debug(" MQTT send: " + mqttCommand + " to " + device.device + " data " + data);
          this.mqttC.publish(
            device.deviceExt.deviceSettings.topic,
            `{"msg":{"accountTopic":"${
              this.session.topic
            }","cmd":"${mqttCommand}","cmdVersion":0,"data":${data},"transaction":"x_${Date.now()}","type":1}}`,
            { qos: 1 },
          );
        }
      } else {
        const idArray = id.split(".");
        const command = id.split(".")[3];
        const stateName = idArray[idArray.length - 1];
        const deviceId = id.split(".")[2];

        if (command === "remote") {
          return;
        }
        const resultDict = {
          onOff: "turn",
          turn: "turn",
          brightness: "brightness",
          r: "r",
          g: "g",
          b: "b",
          colorTemInKelvin: "colorwc",
        };
        if (resultDict[stateName]) {
          const value = state.val;
          await this.setStateAsync(deviceId + ".remote." + resultDict[stateName], value, true);
        }
      }
    }
  }
}
if (require.main !== module) {
  // Export the constructor in compact mode
  /**
   * @param {Partial<utils.AdapterOptions>} [options={}]
   */
  module.exports = (options) => new GoveeApp(options);
} else {
  // otherwise start the instance directly
  new GoveeApp();
}
