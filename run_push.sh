#!/usr/bin/expect -f
set timeout 300
spawn npx drizzle-kit push
while {1} {
    expect {
        "create table" { send "\r"; exp_continue }
        "rename table" { exp_continue }
        "Changes applied" { break }
        eof { break }
        timeout { break }
    }
}
