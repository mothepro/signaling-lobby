# Signaling Lobby

> A simple lobby system which is used as a signaling server for peer-to-peer connections.

## How to Use

Run the server `npx @mothepro/signaling-lobby` and use the following options to control it.

Flag | Alias | Type | Default | Description
-----|-------|------|-------------|--------
`version` | | `boolean` | | Show the version number
`help` | | `boolean` | | Show help
`verbose` | `v` | `count` | None | Verbosity (`-vvvvv` is most verbose)
`hostname` | `h` | `string` | localhost | The hostname to this server is running on
`port` | `p` | `number` | A random free port | The port to host this server on
`max-length` | | `number` | `15` | The max length of a client's name
`max-connections` | | `number` | `65534` | The max number of connections the server supports. `65534` is the max supported
`idle-timeout` | `i` | `number` | `20` minutes | The number of milliseconds a client can be connected to the server without joining a group
`sync-timeout` | `s` | `number` | `30` seconds | The number of milliseconds a client will be connected to the server once syncing is complete
`key` | | `string` | None | Path to the public key to use (Only for a secure server)
`cert` | | `string` | None | Path to the certificate to use (Only for a secure server)

## EC2

First, to support a secure server, create a key & cert pair with `letsencrypt`

Install with the following commandds

```shell
sudo yum-config-manager --enable rhui-REGION-rhel-server-extras rhui-REGION-rhel-server-optional
sudo yum install certbot python2-certbot-apache
sudo yum -y install yum-utils
sudo yum install https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
```

Make a security group that makes the `port` to use available.

Finally, Run the server and set the `hostname` (`-h`) to the external IP.

```shell
npx @mothepro/signaling-lobby -vvvvv \
-h ... \
-p 9000 \
--key /etc/letsencrypt/live/ws.parkshade.com/privkey.pem \
--cert /etc/letsencrypt/live/ws.parkshade.com/fullchain.pem
```

If access to the `*.pem` files is restricted the server be run in `sudo` mode.
This can be enabled with the following command, because by default `sudo npx` doesn't work run, `npx` must be in the `/usr/bin` path.

```shell
sudo ln ~/.nvm/versions/node/<version>/bin/* -s /usr/bin
```

## Install

The Socket Server is exposed as an NPM module so it can be imported to allow for customizations.

`yarn add @mothepro/signaling-lobby`

## Roadmap

+ add DoS prevention (potenetially using 'headers' event)
