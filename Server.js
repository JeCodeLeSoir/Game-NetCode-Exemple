const server = require("ws");
const WebSocket = server.Server;

const port = Number(process.env.PORT) || 8080;

const wss = new WebSocket({
  port: port,
});

const REQ_ConnexionJOIN = 0;
const REQ_PlayerJOIN = 1;
const REQ_PlayerSYNC = 2;
const REQ_PlayerLEAVE = 3;

const REQ_PlayerInputPayload = 4;
const REQ_PlayerStatePayload = 5;

const players = [];

class Payload {
  constructor(value, tick) {
    this.value = value;
    this.tick = tick;
  }

  get Value() {
    return this.value;
  }

  set Value(value) {
    this.value = value;
  }

  get Tick() {
    return this.tick;
  }

  set Tick(tick) {
    this.tick = tick;
  }

}

class Queue {
  constructor() {
    this.items = [];
  }

  Enqueue(item) {
    this.items.push(item);
  }

  Dequeue() {
    if (this.items.length === 0) {
      return null; // ou throw new Error("Queue is empty");
    }
    return this.items.shift();
  }

  Count() {
    return this.items.length;
  }
}

const send = (ws, data) => {
  ws.send(JSON.stringify(data));
}


const SERVER_TICK_RATE = 30;
const BUFFER_SIZE = 1024;
const minTimeBetweenTicks = 1 / SERVER_TICK_RATE;

const FRAME_DURATION = 1000 / 30;

let lastTime = Date.now();
let _DeltaTime_ = 0;

function Loop() {
  const now = Date.now();
  _DeltaTime_ = (now - lastTime) / 1000;
  lastTime = now;

  Update();

  setTimeout(Loop, FRAME_DURATION);
}

function Update() {
  players.forEach((player) => {
    player.Update()
  })
  //console.log(`deltaTime: ${dt.toFixed(3)}s`);
}

Loop();

class Player {
  constructor(ws, publicId) {
    this.ws = ws;
    this.publicId = publicId;

    this.x = Math.random() * 400;
    this.y = Math.random() * 400;
    this.speed = 150;

    this.stateBuffer = [];
    this.timer = 0;
    this.currentTick = 0;

    this.inputQueue = new Queue();
  }

  ProcessMovement(input) {

    this.x += input.value.dir.x * this.speed * _DeltaTime_;
    this.y += input.value.dir.y * this.speed * _DeltaTime_;

    let statePayload = new Payload()

    statePayload.tick = input.tick;
    statePayload.value = {
      pos: {
        x: this.x,
        y: this.y,
      },
    }

    return statePayload;

  }

  HandleTick() {

    players.forEach((player) => {
      if (player.ws === this.ws) return;
      send(player.ws, {
        resquetID: REQ_PlayerSYNC,
        data: {
          id: this.publicId,
          x: this.x,
          y: this.y,
        },
      });
    });

    let bufferIndex = -1;

    while (this.inputQueue.Count() > 0) {
      let inputPayload = this.inputQueue.Dequeue();

      bufferIndex = inputPayload.tick % BUFFER_SIZE;

      let statePayload = this.ProcessMovement(inputPayload);

      this.stateBuffer[bufferIndex] = statePayload;
    }

    if (bufferIndex != -1) {

      let _statePayload = this.stateBuffer[bufferIndex];

      send(this.ws, {
        resquetID: REQ_PlayerInputPayload,
        data: {
          id: this.publicId,
          tick: _statePayload.tick,
          value: _statePayload.value
        },
      });

      //console.log("Sending state", _statePayload, "at tick", this.currentTick);
      //envoyer la position du joueur à tous les autres joueurs
      //players.forEach((player) => {
      //if (player.ws === this.ws) return;

      //});

    }
  }

  Update() {
    this.timer += _DeltaTime_;

    while (this.timer >= minTimeBetweenTicks) {
      this.timer -= minTimeBetweenTicks;
      this.HandleTick();
      this.currentTick++;
    }

  }

  OnClientInput(inputPayload) {
    this.inputQueue.Enqueue(inputPayload);
  }
}


wss.on("connection", (ws) => {
  //const privateId = Math.random().toString(36).substring(2, 9); // generate a random id for the player
  const publicId = Math.random().toString(36).substring(2, 9); // generate a public id for the player

  /*const new_player = {
    ws: ws,
    privateId: privateId,
    publicId: publicId,
    x: Math.random() * 400,
    y: Math.random() * 400,
    speed: 150,

    stateBuffer: [],
    timer: 0,
    currentTick: 0,

    inputQueue: new Queue(),

  };*/

  const new_player = new Player(ws, publicId);

  send(ws, {
    resquetID: REQ_ConnexionJOIN,
    data: {
      id: publicId,
      x: new_player.x,
      y: new_player.y,
    },
  })

  players.push(new_player);

  players.forEach((player) => {
    if (player.publicId === publicId) return;

    // recuperer la position des autres joueurs
    send(ws, {
      resquetID: REQ_PlayerJOIN,
      data: {
        id: player.publicId,
        x: player.x,
        y: player.y,
      },
    });

    // envoyer la position du joueur à tous les autres joueurs
    send(player.ws, {
      resquetID: REQ_PlayerJOIN,
      data: {
        id: publicId,
        x: new_player.x,
        y: new_player.y,
      }
    });
  });

  ws.on("message", (message) => {
    const paquet = JSON.parse(message);
    switch (paquet.resquetID) {
      /*
      case REQ_PlayerSYNC:
        //mettre à jour la position du joueur

        players.forEach((player) => {
          if (player.ws !== ws) return;

          player.x = paquet.data.x;
          player.y = paquet.data.y;

        })

        //envoyer la position du joueur à tous les autres joueurs
        players.forEach((player) => {
          if (player.ws === ws) return;

          send(player.ws, {
            resquetID: REQ_PlayerSYNC,
            data: {
              id: publicId,
              x: paquet.data.x,
              y: paquet.data.y,
            },
          });

        });

        break;*/
      case REQ_PlayerInputPayload:

        //console.log("Input received", paquet.data);

        let inputPayload = new Payload(
          paquet.data.value, paquet.data.tick
        );

        new_player.OnClientInput(inputPayload);

        break;
    }
  });

  ws.on("close", () => {
    // supprimer le joueur de la liste des joueurs
    const playerIndex = players.findIndex((player) => player.publicId === publicId);

    if (playerIndex !== -1) {
      players.splice(playerIndex, 1);
    }

    // on dit aux autres joueurs que un joueur est parti
    players.forEach((player) => {
      send(player.ws, {
        resquetID: REQ_PlayerLEAVE,
        data: {
          id: publicId,
        },
      });
    });
  });

})

wss.on("listening", () => {
  console.log("Server started on port : " + port);
});