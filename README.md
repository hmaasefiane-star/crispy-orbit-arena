# CRISPY ORBIT — Arena Multiplayer prototype

This update starts from the uploaded CrispyOrbit APK web assets.

## What is new
- Multiplayer arena connection using WebSockets.
- Players see each other in the same match.
- Bumping another player within range deals 1 damage.
- 3 HP per player.
- At 0 HP the player is destroyed and disappears for 2 seconds.
- Automatic respawn at an arena spawn point.
- Score increases for the player who destroys another player.
- Touch joystick and existing HOP/BRAKE controls remain available.
- A multiplayer status/score panel is shown during Arena mode.

## Run it on a computer
1. Install Node.js.
2. Open a terminal in `server/`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:8080/` in two browser tabs/devices on the same machine/network.

For internet multiplayer, host the server on a service that supports WebSockets and use `wss://` from an HTTPS game site.

## Important
The uploaded APK is an Android package. This bundle is the editable web-game source plus the multiplayer server; it is not a newly signed Android/iOS package. Rebuilding an iPhone app requires an iOS build/signing step.
