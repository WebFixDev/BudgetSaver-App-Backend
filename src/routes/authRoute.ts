import { Router } from 'express';
import { 
    registerUser, 
    loginUser, 
    forgotPassword, 
    resetPassword,  
    socialAuthCallback,
    verifyUserOTP
} from '../controllers/authController'; 

const router = Router();


router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyUserOTP);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);  


router.post('/google/callback', socialAuthCallback); 
router.post('/facebook/callback', socialAuthCallback); 

export default router;