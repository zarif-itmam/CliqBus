
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.FileWriter;

public class event_script {
    public static void main(String[] args) throws Exception{
        BufferedReader br=new BufferedReader(new FileReader("./events.txt"));
        BufferedWriter bw=new BufferedWriter(new FileWriter("./event_script.txt"));
        while(true){
            String s=br.readLine();
            if(s==null)
                break;
            String[] arr=s.split(",");
            String insertStatement="INSERT INTO EVENT VALUES(SEQ_EVENT.NEXTVAL,'"+arr[0]+"','"+arr[1]+"','"+arr[2]+"',"+arr[3]+");";
            System.out.println(insertStatement);
            bw.write(insertStatement);
            bw.newLine();
        }
        br.close();
        bw.close();
    }
}
