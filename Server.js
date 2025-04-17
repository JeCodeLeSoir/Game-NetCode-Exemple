const server = require("ws");
const WebSocket = server.Server;

const wss = new WebSocket({
  port: 3030,
});

const REQ_ConnexionJOIN = 0;
const REQ_PlayerJOIN = 1;
const REQ_PlayerSYNC = 2;
const REQ_PlayerLEAVE = 3;

const players = [];

const send = (ws, data) => {
  ws.send(JSON.stringify(data));
}

wss.on("connection", (ws) => {
  const privateId = Math.random().toString(36).substring(2, 9); // generate a random id for the player
  const publicId = Math.random().toString(36).substring(2, 9); // generate a public id for the player

  const new_player = {
    ws: ws,
    privateId: privateId,
    publicId: publicId,
    x: Math.random() * 400,
    y: Math.random() * 400,
  };

  send(ws, {
    resquetID: REQ_ConnexionJOIN,
    data: {
      id: privateId,
      x: new_player.x,
      y: new_player.y,
    },
  })

  players.push(new_player);

  players.forEach((player) => {
    if (player.privateId === privateId) return;

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

        break;
    }
  });

  ws.on("close", () => {
    // supprimer le joueur de la liste des joueurs
    const playerIndex = players.findIndex((player) => player.privateId === privateId);

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
  console.log("Server started on port 3030");
});