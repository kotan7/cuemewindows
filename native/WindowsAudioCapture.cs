using System;
using System.IO;
using System.Text;
using System.Text.Json;
using NAudio.Wave;
using NAudio.CoreAudioApi;

namespace WindowsAudioCapture
{
    class Program
    {
        private static WasapiLoopbackCapture capture;
        private static bool isCapturing = false;
        private static readonly object lockObj = new object();

        static void Main(string[] args)
        {
            try
            {
                Console.OutputEncoding = Encoding.UTF8;
                
                if (args.Length > 0)
                {
                    HandleCommand(args[0]);
                }
                else
                {
                    // Interactive mode
                    RunInteractiveMode();
                }
            }
            catch (Exception ex)
            {
                WriteError($"Fatal error: {ex.Message}");
                Environment.Exit(1);
            }
        }

        static void HandleCommand(string command)
        {
            switch (command.ToLower())
            {
                case "status":
                    CheckStatus();
                    break;
                case "permissions":
                    CheckPermissions();
                    break;
                case "start":
                    StartCapture();
                    break;
                case "--help":
                case "-h":
                    ShowHelp();
                    break;
                default:
                    WriteError($"Unknown command: {command}");
                    Environment.Exit(1);
                    break;
            }
        }

        static void RunInteractiveMode()
        {
            WriteInfo("Windows Audio Capture Ready (NAudio WASAPI)");
            
            while (true)
            {
                try
                {
                    string input = Console.ReadLine();
                    if (string.IsNullOrEmpty(input)) continue;

                    switch (input.Trim().ToLower())
                    {
                        case "start":
                            if (!isCapturing)
                            {
                                StartCapture();
                            }
                            else
                            {
                                WriteInfo("Already capturing");
                            }
                            break;
                        case "stop":
                            if (isCapturing)
                            {
                                StopCapture();
                            }
                            else
                            {
                                WriteInfo("Not currently capturing");
                            }
                            break;
                        case "quit":
                        case "exit":
                            if (isCapturing) StopCapture();
                            Environment.Exit(0);
                            break;
                        default:
                            WriteInfo($"Unknown command: {input}");
                            break;
                    }
                }
                catch (Exception ex)
                {
                    WriteError($"Error processing command: {ex.Message}");
                }
            }
        }

        static void CheckStatus()
        {
            try
            {
                var enumerator = new MMDeviceEnumerator();
                var devices = enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active);
                
                var status = new
                {
                    isAvailable = devices.Count > 0,
                    platform = "Windows",
                    version = Environment.OSVersion.Version.ToString(),
                    deviceCount = devices.Count,
                    captureMethod = "WASAPI Loopback"
                };

                Console.WriteLine($"STATUS_DATA: {JsonSerializer.Serialize(status)}");
            }
            catch (Exception ex)
            {
                var errorStatus = new
                {
                    isAvailable = false,
                    error = ex.Message
                };
                Console.WriteLine($"STATUS_DATA: {JsonSerializer.Serialize(errorStatus)}");
            }
        }

        static void CheckPermissions()
        {
            try
            {
                var enumerator = new MMDeviceEnumerator();
                var defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
                
                var result = new
                {
                    granted = defaultDevice != null,
                    message = "Audio devices accessible"
                };

                Console.WriteLine($"PERMISSION_RESULT: {JsonSerializer.Serialize(result)}");
            }
            catch (Exception ex)
            {
                var result = new
                {
                    granted = false,
                    message = $"Audio device access failed: {ex.Message}"
                };
                Console.WriteLine($"PERMISSION_RESULT: {JsonSerializer.Serialize(result)}");
            }
        }

        static void StartCapture()
        {
            try
            {
                lock (lockObj)
                {
                    if (isCapturing)
                    {
                        WriteInfo("Already capturing");
                        return;
                    }

                    WriteStatus("INITIALIZING");

                    // Get default audio device
                    var enumerator = new MMDeviceEnumerator();
                    var defaultDevice = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);

                    if (defaultDevice == null)
                    {
                        WriteError("No default audio device found");
                        return;
                    }

                    WriteInfo($"Using device: {defaultDevice.FriendlyName}");

                    // Create WASAPI loopback capture
                    capture = new WasapiLoopbackCapture(defaultDevice);

                    // Set up event handlers
                    capture.DataAvailable += OnDataAvailable;
                    capture.RecordingStopped += OnRecordingStopped;

                    // Start capture
                    capture.StartRecording();
                    isCapturing = true;

                    WriteStatus("READY");
                    WriteInfo("Audio capture started");
                }
            }
            catch (Exception ex)
            {
                WriteError($"Failed to start capture: {ex.Message}");
                isCapturing = false;
            }
        }

        static void StopCapture()
        {
            try
            {
                lock (lockObj)
                {
                    if (!isCapturing || capture == null)
                    {
                        WriteInfo("Not capturing");
                        return;
                    }

                    capture.StopRecording();
                    capture.Dispose();
                    capture = null;
                    isCapturing = false;

                    WriteInfo("Audio capture stopped");
                }
            }
            catch (Exception ex)
            {
                WriteError($"Error stopping capture: {ex.Message}");
            }
        }

        static void OnDataAvailable(object sender, WaveInEventArgs e)
        {
            try
            {
                if (e.BytesRecorded == 0) return;

                // Convert audio data to base64
                string base64Data = Convert.ToBase64String(e.Buffer, 0, e.BytesRecorded);

                // Output in format expected by Node.js wrapper
                Console.WriteLine($"AUDIO_DATA: {base64Data}");
            }
            catch (Exception ex)
            {
                WriteError($"Error processing audio data: {ex.Message}");
            }
        }

        static void OnRecordingStopped(object sender, StoppedEventArgs e)
        {
            if (e.Exception != null)
            {
                WriteError($"Recording stopped with error: {e.Exception.Message}");
            }
            else
            {
                WriteInfo("Recording stopped");
            }
        }

        static void WriteStatus(string status)
        {
            Console.WriteLine($"STATUS: {status}");
        }

        static void WriteInfo(string message)
        {
            Console.WriteLine($"INFO: {message}");
        }

        static void WriteError(string message)
        {
            Console.Error.WriteLine($"ERROR: {message}");
        }

        static void ShowHelp()
        {
            Console.WriteLine("Windows Audio Capture - WASAPI Loopback");
            Console.WriteLine();
            Console.WriteLine("Commands:");
            Console.WriteLine("  status       - Check audio system status");
            Console.WriteLine("  permissions  - Check audio permissions");
            Console.WriteLine("  start        - Start interactive capture mode");
            Console.WriteLine();
            Console.WriteLine("Interactive mode commands:");
            Console.WriteLine("  start  - Start audio capture");
            Console.WriteLine("  stop   - Stop audio capture");
            Console.WriteLine("  quit   - Exit program");
        }
    }
}
