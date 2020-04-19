# Signaling Lobby

> A simple lobby system which is used as a signaling server for peer-to-peer connections.

## Install

`yarn add @mothepro/signaling-lobby`

## How to Use

Run the server `npx @mothepro/signaling-lobby` and use the following options to control it.

TODO turn to table

```txt
Options:
  --verbose, -v       Verbosity                                          [count]
  --version           Show version number                              [boolean]
  --help              Show help                                        [boolean]
  --max-length        The max length of a user's name
                                               [number] [required] [default: 15]
  --max-connections   The max number of connections the server supports
                                            [number] [required] [default: 65534]
  --idle-timeout, -i  The number of milliseconds a client can be connected to
                      the server without joining a group
                                       [number] [required] [default: 20 minutes]
  --sync-timeout, -s  The number of milliseconds a client will be connected to
                      the server once syncing is complete
                                        [number] [required] [default: 2 minutes]
  --port, -p          The port to host this server on
                               [number] [required] [default: A random free port]
  --key               Path to the public key to use (Only for a secure server)
                                                                        [string]
  --cert              Path to the certificate to use (Only for a secure server)
                                                                        [string]
```

Run the server (In `sudo` to have access to the `*.pem` files) using the following
The `hostname` (`-h`) should be the external IP.

```shell
sudo npx @mothepro/signaling-lobby -vvvvv \
-p 9000 \
--key /etc/letsencrypt/live/ws.parkshade.com/privkey.pem \
--cert /etc/letsencrypt/live/ws.parkshade.com/fullchain.pem
```

### EC2

Create a cert with `letsencrypt`

Install

```shell
sudo yum-config-manager --enable rhui-REGION-rhel-server-extras rhui-REGION-rhel-server-optional
sudo yum install certbot python2-certbot-apache
sudo yum -y install yum-utils
sudo yum install https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
```

Run it...

If `sudo npx` doesn't work run

```shell
sudo ln ~/.nvm/versions/node/<version>/bin/* -s /usr/bin
```

Make a security group that makes that port available.

## Roadmap

+ add DoS prevention (potenetially using 'headers' event)
