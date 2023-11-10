import path from "path";
import fs from "fs";

import { helpers, modules } from "../../../lib/index.js";
import Client from "../../session/Client/handler/Client.js";
import ConnectionSession from "../../session/Session.js";
import {
  ButtonResponse,
  ListResponse,
} from "../../database/db/messageRespon.db.js";
import HistoryMessage from "../../database/db/history.db.js";
import History from "../../database/models/history.model.js";

class ControllerApi extends ConnectionSession {
  constructor() {
    super();
    this.history = new HistoryMessage();
  }

  async clientValidator(req, res, sessions, target) {
    try {
      const toTarget = helpers.phoneNumber(target);
      const client = this.getClient();
      if (!client) {
        res.send({ status: 403, message: `Session ${sessions} not Found` });
        return { toTarget: null, client: null };
      } else if (client && client.isStop == true) {
        res.send({ status: 403, message: `Session ${sessions} is Stopped` });
        return { toTarget: null, client: null };
      }

      if (toTarget.includes("@g.us")) {
        var checkPhone = await client
          .groupMetadata(toTarget)
          .catch((err) => console.log(err));
      } else {
        var checkPhone = await client.onWhatsApp(toTarget);
      }
      if (
        !toTarget.includes("@g.us") &&
        Array.isArray(checkPhone) &&
        checkPhone.length
      ) {
        return { toTarget, client };
      } else if (toTarget.includes("@g.us") && checkPhone?.id) {
        return { toTarget, client };
      } else {
        res.send({
          status: 403,
          message: `The Number/Group (${target}) is not Registered on WhatsApp`,
        });
        return { toTarget: null, client: null };
      }
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async sendText(req, res) {
    try {
      let sessions, target, message;

      if (req.body.sessions == null) {
        sessions = req.query.sessions;
        target = req.query.target;
        message = req.query.message;
      } else {
        sessions = req.body.sessions;
        target = req.body.target;
        message = req.body.message;
      }

      if (!sessions || !target || !message) {
        return res.send({ status: 400, message: "Input All Data!" });
      }
      sessions = sessions.includes("(") ? sessions.split(" (")[0] : sessions;
      const { client, toTarget } = await this.clientValidator(
        req,
        res,
        sessions,
        target
      );
      if (!client || !toTarget) return;
      await new Client(client, toTarget).sendText(message);
      await this.history.pushNewMessage(sessions, "TEXT", toTarget, message);
      return res.send({
        status: 200,
        message: `Success Send Message to ${target}!`,
      });
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async sendLocation(req, res) {
    try {
      let { sessions, target, long, lat } = req.body;
      if (!sessions || !target || !long || !lat) {
        return res.send({ status: 400, message: "Input All Data!" });
      }
      sessions = sessions.includes("(") ? sessions.split(" (")[0] : sessions;
      const { client, toTarget } = await this.clientValidator(
        req,
        res,
        sessions,
        target
      );
      if (!client || !toTarget) return;
      await new Client(client, toTarget).sendLocation(lat, long);
      await this.history.pushNewMessage(
        sessions,
        "LOCATION",
        toTarget,
        `Long : ${long} - Lat : ${lat}`
      );
      return res.send({
        status: 200,
        message: `Success Send Message to ${target}!`,
      });
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async sendMedia(req, res) {
    try {
      let { sessions, target, message, url } = req.body;
      if (!sessions || !target) {
        return res.send({ status: 400, message: "Input Session & Target!" });
      }
      const text = message ? message : "";
      sessions = sessions.includes("(") ? sessions.split(" (")[0] : sessions;
      const { client, toTarget } = await this.clientValidator(
        req,
        res,
        sessions,
        target
      );
      if (!client || !toTarget) return;
      let nameRandom = helpers.randomText(10);
      if (req.files && Object.keys(req.files).length !== 0) {
        const file = req.files.file;
        const dest = `./public/temp/${nameRandom}${path.extname(file.name)}`;
        await file.mv(dest);
        await new Client(client, toTarget).sendMedia(dest, text, { file });
        await this.history.pushNewMessage(
          sessions,
          "MEDIA",
          toTarget,
          `File : ${file.name}, Caption : ${text}`
        );
        res.send({
          status: 200,
          message: `Success Send Message to ${target}!`,
        });
        return await modules.sleep(3000).then(fs.unlinkSync(dest));
      } else if (url && (!req.files || Object.keys(req.files).length === 0)) {
        if (
          /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi.test(
            url
          )
        ) {
          const buffer = await helpers.downloadAxios(url);
          const dest = `./public/temp/${nameRandom}`;
          fs.writeFileSync(dest, buffer.data);
          var opts = {
            file: {
              name: nameRandom,
              mimetype: buffer.headers["content-type"],
            },
          };
          await new Client(client, toTarget).sendMedia(dest, text, opts);
          await this.history.pushNewMessage(
            sessions,
            "MEDIA",
            toTarget,
            `File : ${url}, Caption : ${text}`
          );
          res.send({
            status: 200,
            message: `Success Send Message to ${target}!`,
          });
          return await modules.sleep(3000).then(fs.unlinkSync(dest));
        } else {
          return res.send({ status: 400, message: "Invalid URL!" });
        }
      } else {
        return res.send({
          status: 400,
          message: "No files were uploaded or no URL!",
        });
      }
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async sendSticker(req, res) {
    try {
      let { sessions, target, packname, author, url } = req.body;
      if (!sessions || !target) {
        return res.send({ status: 400, message: "Input Session & Target!" });
      }
      sessions = sessions.includes("(") ? sessions.split(" (")[0] : sessions;
      const { client, toTarget } = await this.clientValidator(
        req,
        res,
        sessions,
        target
      );
      if (!client || !toTarget) return;
      let nameRandom = helpers.randomText(10);
      if (req.files && Object.keys(req.files).length !== 0) {
        const file = req.files.file;
        const dest = `./public/temp/${nameRandom}${path.extname(file.name)}`;
        await file.mv(dest);
        await new Client(client, toTarget).sendSticker(
          true,
          file.mimetype.split("/")[0],
          dest,
          packname,
          author,
          true
        );
        await this.history.pushNewMessage(
          sessions,
          "STICKER",
          toTarget,
          file.name
        );
        return res.send({
          status: 200,
          message: `Success Send Message to ${target}!`,
        });
      } else if (url && (!req.files || Object.keys(req.files).length === 0)) {
        if (
          /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi.test(
            url
          )
        ) {
          const buffer = await helpers.downloadAxios(url);
          const dest = `./public/temp/${nameRandom}`;
          fs.writeFileSync(dest, buffer.data);
          await new Client(client, toTarget).sendSticker(
            true,
            buffer.headers["content-type"].split("/")[0],
            dest,
            packname,
            author,
            true
          );
          await this.history.pushNewMessage(sessions, "STICKER", toTarget, url);
          return res.send({
            status: 200,
            message: `Success Send Message to ${target}!`,
          });
        } else {
          return res.send({ status: 400, message: "Invalid URL!" });
        }
      } else {
        return res.send({
          status: 400,
          message: "No files were uploaded or no URL!",
        });
      }
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async sendProduct(req, res) {
    try {
      let {
        sessions,
        target,
        title,
        message,
        footer,
        owner,
        currency,
        price,
        salePrice,
        url,
      } = req.body;
      if (!sessions || !target) {
        return res.send({ status: 400, message: "Input Session & Target!" });
      }
      sessions = sessions.includes("(") ? sessions.split(" (")[0] : sessions;
      const { client, toTarget } = await this.clientValidator(
        req,
        res,
        sessions,
        target
      );
      if (!client || !toTarget) return;
      let nameRandom = helpers.randomText(10);
      if (req.files && Object.keys(req.files).length !== 0) {
        const file = req.files.file;
        const dest = `./public/temp/${nameRandom}${path.extname(file.name)}`;
        await file.mv(dest);
        var opts = { title, currencyCode: currency, price, salePrice };
        await new Client(client, toTarget).sendProduct(
          dest,
          message,
          footer,
          owner,
          opts
        );
        await this.history.pushNewMessage(
          sessions,
          "PRODUCT",
          toTarget,
          `${title}, ${price} - ${salePrice}`
        );
        res.send({
          status: 200,
          message: `Success Send Message to ${target}!`,
        });
        return await modules.sleep(3000).then(fs.unlinkSync(dest));
      } else if (url && (!req.files || Object.keys(req.files).length === 0)) {
        if (
          /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi.test(
            url
          )
        ) {
          const buffer = await helpers.downloadAxios(url);
          const dest = `./public/temp/${nameRandom}`;
          fs.writeFileSync(dest, buffer.data);
          var opts = { title, currencyCode: currency, price, salePrice };
          await new Client(client, toTarget).sendProduct(
            dest,
            message,
            footer,
            owner,
            opts
          );
          await this.history.pushNewMessage(
            sessions,
            "PRODUCT",
            toTarget,
            `${title}, ${price} - ${salePrice}`
          );
          res.send({
            status: 200,
            message: `Success Send Message to ${target}!`,
          });
          return await modules.sleep(3000).then(fs.unlinkSync(dest));
        } else {
          return res.send({ status: 400, message: "Invalid URL!" });
        }
      } else {
        return res.send({
          status: 400,
          message: "No files were uploaded or no URL!",
        });
      }
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async sendContact(req, res) {
    try {
      let { sessions, target, contact, contactName, anotherContact } = req.body;
      if (!sessions || !target) {
        return res.send({ status: 400, message: "Input Session & Target!" });
      }
      if (anotherContact) {
        let arr = anotherContact.split(",");
        let arr2 = arr?.map((value, i) => {
          if (!value.includes("-")) return { err: "strip" };
          let number = value.split("-")[0].trim();
          let name = value.split("-")[1].trim();
          return { number, name };
        });
        for (let j = 0; j < arr2.length; j++) {
          if (arr2[j].err) {
            return res.send({
              status: 400,
              message: `Wrong Number. Separate contact number and name by using - (min), And separate the second contact with , (comma). (e.g. 628111111111 - Baba, 62822222222 - Caca)`,
            });
          }
        }
        var listNumber = arr2.map((value) => value.number);
        var listName = arr2.map((value) => value.name);
        listNumber.splice(0, 0, contact);
        listName.splice(0, 0, contactName);
      } else {
        var listNumber = [contact];
        var listName = [contactName];
      }
      sessions = sessions.includes("(") ? sessions.split(" (")[0] : sessions;
      const { client, toTarget } = await this.clientValidator(
        req,
        res,
        sessions,
        target
      );
      if (!client || !toTarget) return;
      let stats;
      for (let i = 0; i < listNumber.length; i++) {
        const checking = await client.onWhatsApp(`${listNumber[i]}`);
        if (checking.length === 0) {
          console.log("ini gada array");
          stats = listNumber[i];
        }
      }
      if (stats) {
        return res.send({
          status: 403,
          message: `The Number (${stats}) is not Registered on WhatsApp`,
        });
      } else {
        await new Client(client, toTarget).sendContact(listNumber, listName);
        await this.history.pushNewMessage(
          sessions,
          "CONTACT",
          toTarget,
          `${contact} - ${contactName}, ${anotherContact}`
        );
        return res.send({
          status: 200,
          message: `Success Send Message to ${target}!`,
        });
      }
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async deleteHistory(req, res) {
    try {
      let { id } = req.query;
      if (id) {
        await this.history.deleteHistory(id);
        return res.send({
          status: 200,
          message: `Success Delete History Send Message`,
        });
      } else {
        return res.send({ status: 404, message: `Not Found` });
      }
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async deleteAllHistory(req, res) {
    try {
      await this.history.deleteAllHistory();
      return res.send({
        status: 200,
        message: `Success Delete All History Send Message`,
      });
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }

  async getSessions(req, res) {
    try {
      const data = await this.session.findAll({
        include: [
          {
            model: History,
          },
        ],
      });
      return res.status(200).send({
        data,
      });
    } catch (error) {
      console.log(error);
      return res.send({ status: 500, message: "Internal Server Error" });
    }
  }
}

export default ControllerApi;
