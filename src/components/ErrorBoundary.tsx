import { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { logger } from '../lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    logger.error('🔴 ErrorBoundary: Caught error in getDerivedStateFromError:', error);
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('🔴 ErrorBoundary: Component caught error:', error);
    logger.error('🔴 ErrorBoundary: Error info:', errorInfo);
    logger.error('🔴 ErrorBoundary: Component stack:', errorInfo.componentStack);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    logger.info('🔄 ErrorBoundary: Resetting error state');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>🔴 App Error</Text>
            <Text style={styles.subtitle}>Something went wrong</Text>
          </View>

          <ScrollView style={styles.content}>
            {this.state.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Error Message:</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
              </View>
            )}

            {this.state.errorInfo && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Component Stack:</Text>
                <Text style={styles.stackText}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </View>
            )}

            {this.state.error?.stack && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Stack Trace:</Text>
                <Text style={styles.stackText}>{this.state.error.stack}</Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.resetButton} onPress={this.handleReset}>
            <Text style={styles.resetButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fee2e2',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#ef4444',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#991b1b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#7f1d1d',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#7f1d1d',
    fontFamily: 'monospace',
  },
  stackText: {
    fontSize: 11,
    color: '#7f1d1d',
    fontFamily: 'monospace',
  },
  resetButton: {
    backgroundColor: '#ef4444',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
