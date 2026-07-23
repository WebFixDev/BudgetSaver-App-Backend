import { Router } from 'express';
import { 
    registerUser, 
    loginUser, 
    forgotPassword, 
    resetPassword,  
    googleAuthCallback,
    appleAuthCallback,
    verifyUserOTP
} from '../controllers/authController'; 

const router = Router();


router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyUserOTP);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);  


router.post('/google-login', googleAuthCallback); 
router.post('/apple-login', appleAuthCallback); 


export default router;