import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

const NotFound = () => {
  // Professional IT Color Scheme - Navy Blue & White
  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1C4E80 0%, #0D2C4D 100%)',
      position: 'relative',
      overflow: 'hidden',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    content: {
      textAlign: 'center',
      color: '#FFFFFF',
      zIndex: 10,
      maxWidth: '600px',
      position: 'relative',
    },
    iconWrapper: {
      position: 'relative',
      display: 'inline-block',
      marginBottom: '30px',
    },
    iconCircle: {
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '50%',
      padding: '30px',
      display: 'inline-flex',
      backdropFilter: 'blur(10px)',
      border: '2px solid rgba(165, 216, 221, 0.3)',
      animation: 'pulse 2s ease-in-out infinite',
    },
    alertIcon: {
      color: '#A5D8DD',
      filter: 'drop-shadow(0 0 10px rgba(165, 216, 221, 0.5))',
    },
    errorCode: {
      display: 'flex',
      justifyContent: 'center',
      gap: '15px',
      marginBottom: '30px',
    },
    digit: {
      fontSize: '120px',
      fontWeight: '700',
      color: '#A5D8DD',
      animation: 'fadeInUp 0.6s ease-out both',
      textShadow: '0 4px 20px rgba(165, 216, 221, 0.3)',
      lineHeight: '1',
    },
    errorTitle: {
      fontSize: '36px',
      fontWeight: '600',
      marginBottom: '16px',
      color: '#FFFFFF',
      animation: 'fadeIn 0.8s ease-out 0.4s both',
      letterSpacing: '-0.5px',
    },
    errorMessage: {
      fontSize: '18px',
      lineHeight: '1.6',
      marginBottom: '40px',
      color: 'rgba(255, 255, 255, 0.85)',
      animation: 'fadeIn 0.8s ease-out 0.6s both',
      fontWeight: '400',
    },
    buttonGroup: {
      display: 'flex',
      gap: '15px',
      justifyContent: 'center',
      flexWrap: 'wrap',
      animation: 'fadeIn 0.8s ease-out 0.8s both',
    },
    btnPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: '14px 32px',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '600',
      textDecoration: 'none',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      border: 'none',
      background: '#A5D8DD',
      color: '#1C4E80',
    },
    backgroundCircle: {
      position: 'absolute',
      borderRadius: '50%',
      background: 'rgba(165, 216, 221, 0.08)',
      backdropFilter: 'blur(2px)',
      pointerEvents: 'none',
    },
    circle1: {
      width: '400px',
      height: '400px',
      top: '-100px',
      right: '-100px',
      animation: 'float 15s ease-in-out infinite',
    },
    circle2: {
      width: '300px',
      height: '300px',
      bottom: '-80px',
      left: '-80px',
      animation: 'float 12s ease-in-out infinite reverse',
    },
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(165, 216, 221, 0.4);
          }
          50% {
            transform: scale(1.03);
            box-shadow: 0 0 0 15px rgba(165, 216, 221, 0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0);
            opacity: 0.5;
          }
          50% {
            transform: translate(-20px, -20px);
            opacity: 0.8;
          }
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(165, 216, 221, 0.4);
          background: #B8E5EA;
        }

        .btn-primary:active {
          transform: translateY(0);
        }

        .digit-1 { animation-delay: 0.1s; }
        .digit-2 { animation-delay: 0.2s; }
        .digit-3 { animation-delay: 0.3s; }

        @media (max-width: 768px) {
          .error-code-digit {
            font-size: 80px !important;
          }
          .error-title {
            font-size: 28px !important;
          }
          .error-message {
            font-size: 16px !important;
          }
          .icon-circle {
            padding: 25px !important;
          }
        }

        @media (max-width: 480px) {
          .error-code-digit {
            font-size: 64px !important;
          }
          .error-title {
            font-size: 24px !important;
          }
          .error-message {
            font-size: 15px !important;
          }
        }

        * {
          box-sizing: border-box;
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.content}>
          {/* Animated Icon */}
          <div style={styles.iconWrapper}>
            <div style={styles.iconCircle} className="icon-circle">
              <AlertCircle style={styles.alertIcon} size={64} />
            </div>
          </div>

          {/* 404 Text */}
          <div style={styles.errorCode}>
            <span 
              style={styles.digit} 
              className="error-code-digit digit-1"
            >
              4
            </span>
            <span 
              style={styles.digit} 
              className="error-code-digit digit-2"
            >
              0
            </span>
            <span 
              style={styles.digit} 
              className="error-code-digit digit-3"
            >
              4
            </span>
          </div>

          {/* Message */}
          <h1 style={styles.errorTitle} className="error-title">
            Page Not Found
          </h1>
          <p style={styles.errorMessage} className="error-message">
            The page you're looking for doesn't exist.
            <br />
            Let's get you back to the dashboard.
          </p>

          {/* Action Button */}
          <div style={styles.buttonGroup}>
            <Link 
              to="/" 
              style={styles.btnPrimary}
              className="btn-primary"
            >
              <Home size={20} />
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Background Elements */}
        <div style={{...styles.backgroundCircle, ...styles.circle1}}></div>
        <div style={{...styles.backgroundCircle, ...styles.circle2}}></div>
      </div>
    </>
  );
};

export default NotFound;
