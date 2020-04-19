# Signaling Lobby

> A simple lobby system which is used as a signaling server for peer-to-peer connections.

## Install

`yarn add @mothepro/signaling-lobby`

## How to Use

Run the server `npx @mothepro/signaling-lobby` and use the following options to control it.

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

## Roadmap

+ add DoS prevention (potenetially using 'headers' event)
