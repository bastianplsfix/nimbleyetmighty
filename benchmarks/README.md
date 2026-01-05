# Nimble Benchmarks

Simple benchmarks using [wrk](https://github.com/wg/wrk).

## Prerequisites

Install wrk:

```bash
# macOS
brew install wrk

# Ubuntu/Debian
sudo apt-get install wrk

# Arch Linux
sudo pacman -S wrk
```

## Running Benchmarks

### 1. Start the server

```bash
cd example
deno task start
```

Server runs at `http://localhost:8000` by default.

### 2. Run wrk

Basic benchmark (10 seconds, 2 threads, 10 connections):

```bash
wrk -t2 -c10 -d10s http://localhost:8000/
```

Higher load (30 seconds, 4 threads, 100 connections):

```bash
wrk -t4 -c100 -d30s http://localhost:8000/
```

### Options

| Flag | Description |
|------|-------------|
| `-t` | Number of threads |
| `-c` | Number of connections |
| `-d` | Duration (e.g., `10s`, `1m`) |

## Example Output

```
Running 10s test @ http://localhost:8000/
  2 threads and 10 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    50.12us   15.23us   1.02ms   89.12%
    Req/Sec    95.23k     2.15k   99.87k    75.00%
  1902345 requests in 10.00s, 250.12MB read
Requests/sec: 190234.50
Transfer/sec:     25.01MB
```

## Tips

- Run multiple times for consistent results
- Close other applications to reduce noise
- Test different endpoints: `/`, `/health`, etc.
