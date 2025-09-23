import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AudioSourceSelector } from '../AudioSourceSelector';

// Mock the electron API
const mockElectronAPI = {
  audioGetSources: jest.fn(),
  audioCheckSystemSupport: jest.fn(),
  audioRequestPermissions: jest.fn()
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

describe('AudioSourceSelector', () => {
  const mockOnSourceChange = jest.fn();
  const mockSources = [
    { id: 'microphone', name: 'Microphone', type: 'microphone' as const, available: true },
    { id: 'system-audio', name: 'System Audio', type: 'system' as const, available: true }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.audioGetSources.mockResolvedValue({
      success: true,
      sources: mockSources
    });
    mockElectronAPI.audioCheckSystemSupport.mockResolvedValue({
      supported: true
    });
    mockElectronAPI.audioRequestPermissions.mockResolvedValue({
      granted: true
    });
  });

  it('should render with current source', async () => {
    render(
      <AudioSourceSelector
        currentSource={mockSources[0]}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    render(
      <AudioSourceSelector
        currentSource={null}
        onSourceChange={mockOnSourceChange}
      />
    );

    expect(screen.getByText('Loading audio sources...')).toBeInTheDocument();
  });

  it('should display error state when sources fail to load', async () => {
    mockElectronAPI.audioGetSources.mockResolvedValue({
      success: false,
      error: 'Failed to load sources'
    });

    render(
      <AudioSourceSelector
        currentSource={null}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Audio error')).toBeInTheDocument();
    });
  });

  it('should open dropdown when clicked', async () => {
    render(
      <AudioSourceSelector
        currentSource={mockSources[0]}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Available Audio Sources')).toBeInTheDocument();
    });
  });

  it('should display available sources in dropdown', async () => {
    render(
      <AudioSourceSelector
        currentSource={mockSources[0]}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('System Audio')).toBeInTheDocument();
      expect(screen.getByText('microphone input')).toBeInTheDocument();
      expect(screen.getByText('system input')).toBeInTheDocument();
    });
  });

  it('should call onSourceChange when source is selected', async () => {
    render(
      <AudioSourceSelector
        currentSource={mockSources[0]}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('System Audio')).toBeInTheDocument();
    });

    const systemAudioButton = screen.getByText('System Audio').closest('button');
    if (systemAudioButton) {
      fireEvent.click(systemAudioButton);
    }

    expect(mockOnSourceChange).toHaveBeenCalledWith('system-audio');
  });

  it('should not call onSourceChange for same source', async () => {
    render(
      <AudioSourceSelector
        currentSource={mockSources[0]}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeInTheDocument();
    });

    const microphoneButton = screen.getAllByText('Microphone')[1].closest('button');
    if (microphoneButton) {
      fireEvent.click(microphoneButton);
    }

    expect(mockOnSourceChange).not.toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', async () => {
    render(
      <AudioSourceSelector
        currentSource={mockSources[0]}
        onSourceChange={mockOnSourceChange}
        disabled={true}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  it('should show unavailable sources as disabled', async () => {
    const sourcesWithUnavailable = [
      ...mockSources,
      { id: 'unavailable', name: 'Unavailable Source', type: 'system' as const, available: false }
    ];

    mockElectronAPI.audioGetSources.mockResolvedValue({
      success: true,
      sources: sourcesWithUnavailable
    });

    render(
      <AudioSourceSelector
        currentSource={mockSources[0]}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Microphone')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Unavailable Source (Unavailable)')).toBeInTheDocument();
    });

    const unavailableButton = screen.getByText('Unavailable Source (Unavailable)').closest('button');
    expect(unavailableButton).toBeDisabled();
  });

  it('should show permission request button when sources are unavailable', async () => {
    const sourcesWithUnavailable = [
      { id: 'microphone', name: 'Microphone', type: 'microphone' as const, available: false },
      { id: 'system-audio', name: 'System Audio', type: 'system' as const, available: false }
    ];

    mockElectronAPI.audioGetSources.mockResolvedValue({
      success: true,
      sources: sourcesWithUnavailable
    });

    render(
      <AudioSourceSelector
        currentSource={null}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText('Request Audio Permissions')).toBeInTheDocument();
    });
  });

  it('should request permissions when permission button is clicked', async () => {
    mockElectronAPI.audioGetSources.mockResolvedValue({
      success: true,
      sources: [
        { id: 'microphone', name: 'Microphone', type: 'microphone' as const, available: false }
      ]
    });

    render(
      <AudioSourceSelector
        currentSource={null}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    await waitFor(() => {
      const permissionButton = screen.getByText('Request Audio Permissions');
      fireEvent.click(permissionButton);
    });

    expect(mockElectronAPI.audioRequestPermissions).toHaveBeenCalled();
  });

  it('should show system audio help text', async () => {
    render(
      <AudioSourceSelector
        currentSource={mockSources[0]}
        onSourceChange={mockOnSourceChange}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText('System Audio')).toBeInTheDocument();
      expect(screen.getByText(/Captures audio from your computer/)).toBeInTheDocument();
    });
  });
});