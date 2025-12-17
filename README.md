<div align="center">
<img src="./md-assets/puddysql.jpg" alt="banner" />
<p>
    <a href="https://discord.gg/TgHdvJd"><img src="https://img.shields.io/discord/413193536188579841?color=7289da&logo=discord&logoColor=white" alt="Discord server" /></a>
    <a href="https://www.npmjs.com/package/puddysql"><img src="https://img.shields.io/npm/v/puddysql.svg?maxAge=3600" alt="NPM version" /></a>
    <a href="https://www.npmjs.com/package/puddysql"><img src="https://img.shields.io/npm/dt/puddysql.svg?maxAge=3600" alt="NPM downloads" /></a>
</p>
<p>
    <a href="https://www.patreon.com/JasminDreasond"><img src="https://img.shields.io/badge/donate-patreon-F96854.svg?logo=patreon" alt="Patreon" /></a>
    <a href="https://ko-fi.com/jasmindreasond"><img src="https://img.shields.io/badge/donate-ko%20fi-29ABE0.svg?logo=ko-fi" alt="Ko-Fi" /></a>
    <a href="https://chain.so/address/BTC/bc1qnk7upe44xrsll2tjhy5msg32zpnqxvyysyje2g"><img src="https://img.shields.io/badge/donate-bitcoin-F7931A.svg?logo=bitcoin" alt="Bitcoin" /></a>
    <a href="https://chain.so/address/LTC/ltc1qchk520v4u8334n5dntmgeja55gc5g5rrkgpd4f"><img src="https://img.shields.io/badge/donate-litecoin-345D9D.svg?logo=litecoin" alt="Litecoin" /></a>
</p>
<p>
    <a href="https://nodei.co/npm/puddysql/"><img src="https://nodei.co/npm/puddysql.png?downloads=true&stars=true" alt="npm installnfo" /></a>
</p>
</div>

# 🍮 PuddySQL

**PuddySQL** is a modular and extensible SQL toolkit for Node.js — designed to make dynamic queries, filters, pagination, and tag-based searches easy, safe, and powerful.

Built with composability in mind, each part of PuddySQL focuses on one job while integrating smoothly with the others. Whether you're working with SQLite or PostgreSQL, this package helps you build robust, readable, and scalable query logic.

---

## 📦 Installation

```bash
npm install puddysql
```

---

## 🧱 Main Features

* ✅ Safe, composable SQL queries with named methods
* 🔍 Powerful nested filters using JSON logic (AND/OR, operators, etc.)
* 🏷️ Built-in tag filtering engine for JSON/array-based fields
* 🔗 Dynamic JOIN builder with alias support
* 📃 Smart pagination with automatic counters
* 🧪 Strong input validation and type safety

---

## 📚 Documentation

For API reference, check each module’s own documentation:

👉 **See:** [`docs/README.md`](./docs/README.md)

---

## 🔧 Module Overview

| Module             | Description                                 |
| ------------------ | ------------------------------------------- |
| `PuddySqlEngine`   | Low-level query runner with DB abstraction  |
| `PuddySqlInstance` | Manages databases and table bindings        |
| `PuddySqlQuery`    | High-level querying with filters and joins  |
| `PuddySqlTags`     | Parses tag filters into safe SQL conditions |

---

## 🧪 Requirements

* Node.js 18+ recommended
* Works with:

  * ✅ SQLite3
  * ✅ PostgreSQL (via `pg` adapter)

---

## 🧭 Modules Menu

The `PuddySql` class is the main access point to all core features of the library.
You should not instantiate it directly — instead, use `PuddySql.Instance`.

Here's a quick overview of what's available:

| 📦 Static Property  | 🔍 Description                                                              |
| ------------------- | --------------------------------------------------------------------------- |
| `PuddySql.Instance` | 🎮 Main SQL client class for managing databases (PostgreSQL or SQLite3)     |
| `PuddySql.Query`    | 🧠 Query builder and smart search engine with advanced filtering            |
| `PuddySql.Tags`     | 🏷️ Flexible tag system parser (with support for JSON arrays, boosts, etc.)  |
| `PuddySql.Events`   | 🎯 Event manager to attach lifecycle hooks to query logic                   |
| `PuddySql.Utils`    | 🛠️ Useful utilities (object flattening, merge helpers, SQL formatters)      |
| `PuddySql.pg`       | 🐘 PostgreSQL database engine (pg wrapper)                                  |
| `PuddySql.sqlite3`  | 📀 SQLite3 engine for local/in-memory usage (sqlite3 wrapper)               |

---

## 🚀 Quick Example

Here’s how to get started using **PuddySQL**:

```js
import path from 'path';
import { fileURLToPath } from 'url';
import PuddySql from 'puddysql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🎮 Create a new SQL instance
const db = new PuddySql.Instance();

// 📡 Run queries
(async () => {
  await db.initSqlite3();

  // Insert a new user
  const table = await db.initTable({ name: 'tinytest', id: 'id' }, [
      ['id', 'TEXT', 'PRIMARY KEY'],
      ['prompt', 'TEXT'],
      ['yay', 'BOOLEAN']
  ]);

  console.log('Set');
  console.log(await table.set('1', { prompt: 'pudding', yay: true }));
  console.log(await table.set('2', { prompt: 'cookie', yay: true }));
  console.log(await table.set('3', { prompt: 'brigadeiro', yay: true }));
  console.log(await table.set('4', { prompt: 'banana', yay: false }));
  console.log(await table.set('5', { prompt: 'chocolate', yay: true }));

  console.log('Get All');
  console.log(await table.getAll());

  // Find a user by ID
  console.log('Get');
  const user = await table.get(1);
  console.log(user); // → { id: 1, prompt: 'pudding', yay: true }

  // Get a paginated list
  console.log('Search');
  const data1 = await db.getTable('tinytest').search({
      q: {
        group: 'AND',
        conditions: [{ column: 'prompt', value: 'pudding' }],
      },
    });

  const data2 = await table.search({
      q: {
          group: 'OR',
          conditions: [
            { column: 'prompt', value: 'pudding' },
            { column: 'yay', value: false },
          ],
      },
    });

  console.log(data1); 
  console.log(data2); 
})();
```

---

## 🤝 Contributions

Feel free to fork, contribute, and create pull requests for improvements! Whether it's a bug fix or an additional feature, contributions are always welcome.

## 📝 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

> 🧠 **Note**: This documentation was written by [ChatGPT](https://openai.com/chatgpt), an AI assistant developed by OpenAI, based on the project structure and descriptions provided by the repository author.  
> If you find any inaccuracies or need improvements, feel free to contribute or open an issue!

---

## 🔙 Back to Tiny Essentials

Did you like this module? It’s part of the **Tiny Essentials** collection — a set of minimal yet powerful tools to make development easier.
👉 [Click here to explore more Tiny Essentials modules](https://github.com/Tiny-Essentials/Tiny-Essentials)

---

<div align="center">
<a href="./md-assets/img/"><img src="./md-assets/img/85382271-5cf7-4806-ab8c-921167c0d8d7.png" height="300" /></a>
<br/>
Made with tiny love!
</div>